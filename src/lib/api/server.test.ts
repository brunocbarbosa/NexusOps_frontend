/**
 * @jest-environment node
 */
import { SessionExpiredError } from "./errors";
import { __resetRefreshFlights } from "./refresh";
import { apiFetch, apiFetchPublic } from "./server";

jest.mock("next/headers", () => {
  const { cookieJar: jar } =
    jest.requireActual<typeof import("../../test/cookie-jar")>(
      "../../test/cookie-jar",
    );

  return { cookies: () => Promise.resolve(jar) };
});

import { cookieJar as jar } from "../../test/cookie-jar";

const fetchMock = jest.fn();

beforeEach(() => {
  jar.reset();
  fetchMock.mockReset();
  __resetRefreshFlights();
  globalThis.fetch = fetchMock;
});

function signedIn(accessToken = "access-1", refreshToken = "refresh-1") {
  jar.set("nexusops_at", accessToken);
  jar.set("nexusops_rt", refreshToken);
}

function authHeaderOf(call: number): string | null {
  const [, init] = fetchMock.mock.calls[call] as [string, RequestInit];
  return new Headers(init.headers).get("authorization");
}

const unauthorized = () =>
  Response.json({ message: "Unauthorized", statusCode: 401 }, { status: 401 });

const rotated = () =>
  Response.json({
    accessToken: "access-2",
    refreshToken: "refresh-2",
    user: { id: "u1", email: "admin@acme.com", role: "ADMIN" },
  });

describe("apiFetch", () => {
  it("recusa sem sessão nenhuma, sem sequer chamar a API", async () => {
    await expect(apiFetch("/users")).rejects.toBeInstanceOf(SessionExpiredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("manda o access token como Bearer", async () => {
    signedIn();
    fetchMock.mockResolvedValue(Response.json({ data: [], meta: {} }));

    const response = await apiFetch("/users");

    expect(response.status).toBe(200);
    expect(authHeaderOf(0)).toBe("Bearer access-1");
  });

  it("renova e repete UMA vez quando o access token expirou", async () => {
    signedIn();
    fetchMock
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(rotated())
      .mockResolvedValueOnce(Response.json({ data: [] }));

    const response = await apiFetch("/users");

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(authHeaderOf(2)).toBe("Bearer access-2");
    // O par rotacionado tem de sobreviver à requisição: reapresentar o antigo
    // é o reuso que revoga a família inteira.
    expect(jar.valueOf("nexusops_at")).toBe("access-2");
    expect(jar.valueOf("nexusops_rt")).toBe("refresh-2");
  });

  it("não entra em laço: um 401 que sobrevive à renovação é devolvido como está", async () => {
    signedIn();
    fetchMock
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(rotated())
      .mockResolvedValueOnce(unauthorized());

    const response = await apiFetch("/users");

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("renova antes da primeira chamada quando só o cookie de refresh sobrou", async () => {
    jar.set("nexusops_rt", "refresh-1");
    fetchMock
      .mockResolvedValueOnce(rotated())
      .mockResolvedValueOnce(Response.json({ data: [] }));

    await apiFetch("/users");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(authHeaderOf(1)).toBe("Bearer access-2");
  });

  it("não renova por um 401 de negócio — só o guard responde 'Unauthorized' puro", async () => {
    // `PATCH /users/me/password` recusa a senha atual com 401. Renovar aí
    // gastaria uma rotação de refresh token a cada tentativa errada.
    signedIn();
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { message: "The current password is incorrect", error: "Unauthorized", statusCode: 401 },
        { status: 401 },
      ),
    );

    const response = await apiFetch("/users/me/password", { method: "PATCH" });

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toMatchObject({
      message: "The current password is incorrect",
    });
    expect(jar.has("nexusops_rt")).toBe(true);
  });

  it("apaga os dois cookies e encerra a sessão quando a renovação falha", async () => {
    signedIn();
    fetchMock.mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(unauthorized());

    await expect(apiFetch("/users")).rejects.toBeInstanceOf(SessionExpiredError);
    expect(jar.has("nexusops_at")).toBe(false);
    expect(jar.has("nexusops_rt")).toBe(false);
  });

  it("monta a query string e o corpo JSON", async () => {
    signedIn();
    fetchMock.mockResolvedValue(Response.json({}));

    await apiFetch("/users", {
      method: "POST",
      body: { email: "agent@acme.com" },
      searchParams: new URLSearchParams({ includeDeleted: "false" }),
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/users\?includeDeleted=false$/);
    expect(init.body).toBe(JSON.stringify({ email: "agent@acme.com" }));
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
  });
});

describe("apiFetchPublic", () => {
  it("não manda Authorization — login e refresh são rotas públicas", async () => {
    fetchMock.mockResolvedValue(Response.json({}));

    await apiFetchPublic("/auth/login", { method: "POST", body: {} });

    expect(authHeaderOf(0)).toBeNull();
  });
});

/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";

import { parseRequestBody } from "../../../test/http";
import { GET, POST } from "./route";

jest.mock("next/headers", () => {
  const { cookieJar: jar } = jest.requireActual<
    typeof import("../../../test/cookie-jar")
  >("../../../test/cookie-jar");

  return { cookies: () => Promise.resolve(jar) };
});

import { cookieJar as jar } from "../../../test/cookie-jar";

const fetchMock = jest.fn();

beforeEach(() => {
  jar.reset();
  jar.set("nexusops_at", "access-1");
  jar.set("nexusops_rt", "refresh-1");
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(Response.json({ data: [], meta: { total: 0 } }));
  globalThis.fetch = fetchMock;
});

function calledUrl(): URL {
  const [url] = fetchMock.mock.calls[0] as [string];

  return new URL(url);
}

async function get(query: string): Promise<Response> {
  return GET(new NextRequest(`http://localhost:3001/api/users${query}`));
}

describe("GET /api/users", () => {
  it("repassa os filtros que o backend conhece", async () => {
    await get("?page=2&perPage=50&role=AGENT&search=acme");

    const params = calledUrl().searchParams;
    expect(params.get("page")).toBe("2");
    expect(params.get("perPage")).toBe("50");
    expect(params.get("role")).toBe("AGENT");
    expect(params.get("search")).toBe("acme");
  });

  it("manda includeDeleted como o texto 'true' — booleano em query string é texto", async () => {
    await get("?includeDeleted=true");

    expect(calledUrl().searchParams.get("includeDeleted")).toBe("true");
  });

  it("omite includeDeleted quando não pedido, em vez de mandar 'false'", async () => {
    await get("?page=1");

    expect(calledUrl().searchParams.has("includeDeleted")).toBe(false);
  });

  it("descarta parâmetro desconhecido, que o backend recusaria com 400", async () => {
    await get("?tenantId=outro-tenant&sort=email");

    expect(calledUrl().search).toBe("");
  });

  it("descarta papel inválido e página não numérica", async () => {
    await get("?role=SUPERUSER&page=abc");

    expect(calledUrl().search).toBe("");
  });

  it("limita perPage ao teto de 100 do backend", async () => {
    await get("?perPage=500");

    expect(calledUrl().searchParams.get("perPage")).toBe("100");
  });

  it("devolve 401 sem sessão, sem chamar a API", async () => {
    jar.reset();

    const response = await get("");

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/users", () => {
  function post(body: unknown): Promise<Response> {
    return POST(
      new Request("http://localhost:3001/api/users", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  }

  it("manda email, senha e papel", async () => {
    fetchMock.mockResolvedValue(Response.json({ id: "u2" }, { status: 201 }));

    await post({ email: "agent@acme.com", password: "another good one", role: "AGENT" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(parseRequestBody(init)).toEqual({
      email: "agent@acme.com",
      password: "another good one",
      role: "AGENT",
    });
  });

  it("omite o papel quando não escolhido — o backend usa REQUESTER", async () => {
    fetchMock.mockResolvedValue(Response.json({ id: "u2" }, { status: 201 }));

    await post({ email: "agent@acme.com", password: "another good one" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(parseRequestBody(init)).toEqual({
      email: "agent@acme.com",
      password: "another good one",
    });
  });

  it("repassa o 409 que aponta o usuário desativado, com a mensagem intacta", async () => {
    const message =
      "agent@acme.com belongs to a deactivated user (95e8836c-9c1e-4c1f-93a1-0b0b0d1a2b3c). Restore them instead of creating a duplicate.";
    fetchMock.mockResolvedValue(
      Response.json({ message, error: "Conflict", statusCode: 409 }, { status: 409 }),
    );

    const response = await post({ email: "agent@acme.com", password: "another good one" });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ message });
  });
});

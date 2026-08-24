/**
 * @jest-environment node
 */
import { POST } from "./route";

jest.mock("next/headers", () => {
  const { cookieJar: jar } = jest.requireActual<
    typeof import("../../../../test/cookie-jar")
  >("../../../../test/cookie-jar");

  return { cookies: () => Promise.resolve(jar) };
});

import { cookieJar as jar } from "../../../../test/cookie-jar";

const fetchMock = jest.fn();

beforeEach(() => {
  jar.reset();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
});

function loginRequest(body: unknown): Request {
  return new Request("http://localhost:3001/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const credentials = {
  tenantDomain: "acme.com",
  email: "admin@acme.com",
  password: "correct horse battery",
};

describe("POST /api/auth/login", () => {
  it("guarda os tokens em cookie httpOnly e NÃO os devolve ao browser", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        accessToken: "access-1",
        refreshToken: "refresh-1",
        user: { id: "u1", email: "admin@acme.com", role: "ADMIN" },
      }),
    );

    const response = await POST(loginRequest(credentials));
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      user: { id: "u1", email: "admin@acme.com", role: "ADMIN" },
    });
    expect(JSON.stringify(body)).not.toContain("access-1");
    expect(JSON.stringify(body)).not.toContain("refresh-1");

    expect(jar.stored("nexusops_at")).toMatchObject({
      value: "access-1",
      options: { httpOnly: true, sameSite: "lax", path: "/" },
    });
    expect(jar.stored("nexusops_rt")).toMatchObject({
      value: "refresh-1",
      options: { httpOnly: true },
    });
  });

  it("repassa o 401 com a mensagem única do backend e não grava cookie", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { message: "Invalid credentials", error: "Unauthorized", statusCode: 401 },
        { status: 401 },
      ),
    );

    const response = await POST(loginRequest(credentials));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      message: "Invalid credentials",
    });
    expect(jar.has("nexusops_at")).toBe(false);
  });

  it("recusa corpo incompleto antes de chamar a API", async () => {
    const response = await POST(loginRequest({ email: "admin@acme.com" }));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("responde 502 quando a API está fora do ar", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const response = await POST(loginRequest(credentials));

    expect(response.status).toBe(502);
  });

  it("manda ao backend exatamente os três campos, e nada mais", async () => {
    // O ValidationPipe roda com forbidNonWhitelisted: um campo a mais é 400.
    fetchMock.mockResolvedValue(
      Response.json({
        accessToken: "a",
        refreshToken: "r",
        user: { id: "u1" },
      }),
    );

    await POST(loginRequest({ ...credentials, tenantId: "leaked" }));

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify(credentials));
  });
});

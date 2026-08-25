/**
 * @jest-environment node
 */
import { DELETE, GET, PATCH } from "./route";

jest.mock("next/headers", () => {
  const { cookieJar: jar } = jest.requireActual<
    typeof import("../../../../test/cookie-jar")
  >("../../../../test/cookie-jar");

  return { cookies: () => Promise.resolve(jar) };
});

import { cookieJar as jar } from "../../../../test/cookie-jar";
import { parseRequestBody } from "../../../../test/http";

const fetchMock = jest.fn();

beforeEach(() => {
  jar.reset();
  jar.set("nexusops_at", "access-1");
  jar.set("nexusops_rt", "refresh-1");
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
});

const context = { params: Promise.resolve({ id: "u1" }) };

function request(body: unknown): Request {
  return new Request("http://localhost:3001/api/users/u1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

function calledUrl(): string {
  const [url] = fetchMock.mock.calls[0] as [string];

  return url;
}

describe("/api/users/[id]", () => {
  it("GET repassa o 404 de recurso de outro tenant sem traduzi-lo para 403", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ message: "No user u1", statusCode: 404 }, { status: 404 }),
    );

    const response = await GET(new Request("http://localhost:3001/api/users/u1"), context);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ message: "No user u1" });
  });

  it("PATCH manda só email e papel", async () => {
    fetchMock.mockResolvedValue(Response.json({ id: "u1" }));

    await PATCH(request({ email: "new@acme.com", role: "AGENT" }), context);

    expect(calledUrl()).toMatch(/\/users\/u1$/);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(parseRequestBody(init)).toEqual({ email: "new@acme.com", role: "AGENT" });
  });

  it("PATCH recusa senha: trocar a de outra pessoa não passa por esta rota", async () => {
    const response = await PATCH(request({ password: "hijack" }), context);

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("DELETE desativa e repassa o 409 de estado", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { message: "This user is already deactivated", statusCode: 409 },
        { status: 409 },
      ),
    );

    const response = await DELETE(
      new Request("http://localhost:3001/api/users/u1", { method: "DELETE" }),
      context,
    );

    expect(response.status).toBe(409);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("DELETE");
  });
});

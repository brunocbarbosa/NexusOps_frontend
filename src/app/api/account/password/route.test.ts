/**
 * @jest-environment node
 */
import { PATCH } from "./route";

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

function request(body: unknown): Request {
  return new Request("http://localhost:3001/api/account/password", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/account/password", () => {
  it("encaminha as duas senhas para a rota do backend", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const response = await PATCH(
      request({ currentPassword: "old one", newPassword: "brand new one" }),
    );

    expect(response.status).toBe(204);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/users\/me\/password$/);
    expect(parseRequestBody(init)).toEqual({
      currentPassword: "old one",
      newPassword: "brand new one",
    });
  });

  it("repassa o 401 de senha atual incorreta", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { message: "The current password is incorrect", statusCode: 401 },
        { status: 401 },
      ),
    );

    const response = await PATCH(
      request({ currentPassword: "wrong", newPassword: "brand new one" }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      message: "The current password is incorrect",
    });
  });

  it("recusa corpo incompleto antes de chamar a API", async () => {
    const response = await PATCH(request({ newPassword: "brand new one" }));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

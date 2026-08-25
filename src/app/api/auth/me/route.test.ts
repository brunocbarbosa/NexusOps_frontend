/**
 * @jest-environment node
 */
import { GET } from "./route";

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

describe("GET /api/auth/me", () => {
  it("devolve a identidade do chamador", async () => {
    jar.set("nexusops_at", "access-1");
    jar.set("nexusops_rt", "refresh-1");
    const identity = {
      id: "u1",
      tenantId: "t1",
      email: "admin@acme.com",
      role: "ADMIN",
    };
    fetchMock.mockResolvedValue(Response.json(identity));

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(identity);
  });

  it("responde 401 sem sessão — é assim que a casca sabe mandar para o login", async () => {
    const response = await GET();

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

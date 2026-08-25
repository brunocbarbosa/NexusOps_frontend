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

describe("POST /api/auth/logout", () => {
  it("revoga o refresh token no backend e apaga os cookies", async () => {
    jar.set("nexusops_at", "access-1");
    jar.set("nexusops_rt", "refresh-1");
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const response = await POST();

    expect(response.status).toBe(204);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/auth\/logout$/);
    expect(init.body).toBe(JSON.stringify({ refreshToken: "refresh-1" }));
    expect(jar.has("nexusops_at")).toBe(false);
    expect(jar.has("nexusops_rt")).toBe(false);
  });

  it("sai mesmo com a API fora do ar — o cookie é o que prende a sessão aqui", async () => {
    jar.set("nexusops_at", "access-1");
    jar.set("nexusops_rt", "refresh-1");
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const response = await POST();

    expect(response.status).toBe(204);
    expect(jar.has("nexusops_rt")).toBe(false);
  });

  it("não chama a API quando já não há sessão", async () => {
    const response = await POST();

    expect(response.status).toBe(204);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

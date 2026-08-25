/**
 * @jest-environment node
 */
import { POST } from "./route";

jest.mock("next/headers", () => {
  const { cookieJar: jar } = jest.requireActual<
    typeof import("../../../../../test/cookie-jar")
  >("../../../../../test/cookie-jar");

  return { cookies: () => Promise.resolve(jar) };
});

import { cookieJar as jar } from "../../../../../test/cookie-jar";

const fetchMock = jest.fn();

beforeEach(() => {
  jar.reset();
  jar.set("nexusops_at", "access-1");
  jar.set("nexusops_rt", "refresh-1");
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
});

describe("POST /api/users/[id]/restore", () => {
  it("reativa o usuário e devolve a mesma linha", async () => {
    fetchMock.mockResolvedValue(Response.json({ id: "u1", deletedAt: null }));

    const response = await POST(
      new Request("http://localhost:3001/api/users/u1/restore", { method: "POST" }),
      { params: Promise.resolve({ id: "u1" }) },
    );

    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/users\/u1\/restore$/);
    expect(init.method).toBe("POST");
  });
});

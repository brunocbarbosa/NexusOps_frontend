/**
 * @jest-environment node
 */
import { POST } from "./route";

jest.mock("next/headers", () => {
  const { cookieJar: jar } = jest.requireActual<
    typeof import("../../../../../../../../test/cookie-jar")
  >("../../../../../../../../test/cookie-jar");

  return { cookies: () => Promise.resolve(jar) };
});

import { cookieJar as jar } from "../../../../../../../../test/cookie-jar";

const fetchMock = jest.fn();

beforeEach(() => {
  jar.reset();
  jar.set("nexusops_at", "access-1");
  jar.set("nexusops_rt", "refresh-1");
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(Response.json({ id: "u1", deletedAt: null }));
  globalThis.fetch = fetchMock;
});

describe("POST /api/platform/companies/[companyId]/users/[userId]/restore", () => {
  it("reativa o usuário dentro da company", async () => {
    await POST(new Request("http://localhost:3001/x", { method: "POST" }), {
      params: Promise.resolve({ companyId: "c1", userId: "u1" }),
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe("/platform/companies/c1/users/u1/restore");
    expect(init.method).toBe("POST");
  });

  it("repassa o 409 de quem não estava desativado — a lista é que está velha", async () => {
    const message = "This user is not deactivated";
    fetchMock.mockResolvedValue(
      Response.json({ message, error: "Conflict", statusCode: 409 }, { status: 409 }),
    );

    const response = await POST(new Request("http://localhost:3001/x", { method: "POST" }), {
      params: Promise.resolve({ companyId: "c1", userId: "u1" }),
    });

    expect(response.status).toBe(409);
  });
});

/**
 * @jest-environment node
 */
import { parseRequestBody } from "../../../../../../../test/http";
import { DELETE, PATCH } from "./route";

jest.mock("next/headers", () => {
  const { cookieJar: jar } = jest.requireActual<
    typeof import("../../../../../../../test/cookie-jar")
  >("../../../../../../../test/cookie-jar");

  return { cookies: () => Promise.resolve(jar) };
});

import { cookieJar as jar } from "../../../../../../../test/cookie-jar";

const fetchMock = jest.fn();

beforeEach(() => {
  jar.reset();
  jar.set("nexusops_at", "access-1");
  jar.set("nexusops_rt", "refresh-1");
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(Response.json({ id: "u1" }));
  globalThis.fetch = fetchMock;
});

const context = { params: Promise.resolve({ companyId: "c1", userId: "u1" }) };

function patch(body: unknown): Promise<Response> {
  return PATCH(
    new Request("http://localhost:3001/x", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    context,
  );
}

describe("PATCH /api/platform/companies/[companyId]/users/[userId]", () => {
  it("altera email e papel dentro da company", async () => {
    await patch({ email: "novo@acme.example", role: "ADMIN" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe("/platform/companies/c1/users/u1");
    expect(parseRequestBody(init)).toEqual({
      email: "novo@acme.example",
      role: "ADMIN",
    });
  });

  it("não deixa passar senha — trocar a de outra pessoa não é ação de admin", async () => {
    await patch({ email: "novo@acme.example", password: "sequestro" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(parseRequestBody(init)).toEqual({ email: "novo@acme.example" });
  });

  it("recusa corpo vazio antes de chamar a API", async () => {
    const response = await patch({});

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("repassa o 409 do último ADMIN com a mensagem intacta", async () => {
    const message = "The last active ADMIN cannot be demoted. Promote another user first.";
    fetchMock.mockResolvedValue(
      Response.json({ message, error: "Conflict", statusCode: 409 }, { status: 409 }),
    );

    const response = await patch({ role: "AGENT" });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ message });
  });
});

describe("DELETE /api/platform/companies/[companyId]/users/[userId]", () => {
  it("desativa e devolve 204 sem corpo", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const response = await DELETE(new Request("http://localhost:3001/x"), context);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe("/platform/companies/c1/users/u1");
    expect(init.method).toBe("DELETE");
    expect(response.status).toBe(204);
  });
});

/**
 * @jest-environment node
 */
import { parseRequestBody } from "../../../../../test/http";
import { DELETE, GET, PATCH } from "./route";

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
  fetchMock.mockResolvedValue(Response.json({ id: "c1" }));
  globalThis.fetch = fetchMock;
});

const context = { params: Promise.resolve({ companyId: "c1" }) };

function calledUrl(): string {
  const [url] = fetchMock.mock.calls[0] as [string];

  return url;
}

function patch(body: unknown): Promise<Response> {
  return PATCH(
    new Request("http://localhost:3001/api/platform/companies/c1", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    context,
  );
}

describe("GET /api/platform/companies/[companyId]", () => {
  it("busca a company pelo id", async () => {
    await GET(new Request("http://localhost:3001/x"), context);

    expect(calledUrl()).toContain("/platform/companies/c1");
  });

  it("repassa o 404 como 404 — nunca vira 'existe em outro tenant'", async () => {
    // O backend responde 404 justamente para não confirmar que o id existe em
    // algum lugar. A UI não pode desfazer isso.
    fetchMock.mockResolvedValue(
      Response.json({ message: "No company c1", error: "Not Found", statusCode: 404 }, { status: 404 }),
    );

    const response = await GET(new Request("http://localhost:3001/x"), context);

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/platform/companies/[companyId]", () => {
  it("manda isActive como booleano de verdade", async () => {
    // `pickStrings` o descartaria e o PATCH viraria "nada para atualizar".
    await patch({ isActive: false });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(parseRequestBody(init)).toEqual({ isActive: false });
  });

  it("aceita bloquear e renomear na mesma requisição", async () => {
    await patch({ name: "Acme Ltd", domain: "acme.example", isActive: true });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(parseRequestBody(init)).toEqual({
      name: "Acme Ltd",
      domain: "acme.example",
      isActive: true,
    });
  });

  it("descarta campo que nenhum DTO declara", async () => {
    await patch({ name: "Acme Ltd", id: "c1", isPlatform: true, createdAt: "2026-01-01" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(parseRequestBody(init)).toEqual({ name: "Acme Ltd" });
  });

  it("recusa corpo vazio antes de chamar a API", async () => {
    const response = await patch({ id: "c1" });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/platform/companies/[companyId]", () => {
  it("apaga de verdade e devolve 204 sem corpo", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const response = await DELETE(new Request("http://localhost:3001/x"), context);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("DELETE");
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });
});

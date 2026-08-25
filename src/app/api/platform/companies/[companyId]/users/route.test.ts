/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";

import { parseRequestBody } from "../../../../../../test/http";
import { GET, POST } from "./route";

jest.mock("next/headers", () => {
  const { cookieJar: jar } = jest.requireActual<
    typeof import("../../../../../../test/cookie-jar")
  >("../../../../../../test/cookie-jar");

  return { cookies: () => Promise.resolve(jar) };
});

import { cookieJar as jar } from "../../../../../../test/cookie-jar";

const fetchMock = jest.fn();

beforeEach(() => {
  jar.reset();
  jar.set("nexusops_at", "access-1");
  jar.set("nexusops_rt", "refresh-1");
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(Response.json({ data: [], meta: { total: 0 } }));
  globalThis.fetch = fetchMock;
});

const context = { params: Promise.resolve({ companyId: "c1" }) };

function calledUrl(): URL {
  const [url] = fetchMock.mock.calls[0] as [string];

  return new URL(url);
}

function get(query: string): Promise<Response> {
  return GET(
    new NextRequest(`http://localhost:3001/api/platform/companies/c1/users${query}`),
    context,
  );
}

describe("GET /api/platform/companies/[companyId]/users", () => {
  it("escopa a listagem na company do caminho", async () => {
    await get("");

    expect(calledUrl().pathname).toBe("/platform/companies/c1/users");
  });

  it("repassa os mesmos filtros de /users", async () => {
    await get("?page=2&perPage=50&role=AGENT&search=ana&includeDeleted=true");

    const params = calledUrl().searchParams;
    expect(params.get("page")).toBe("2");
    expect(params.get("perPage")).toBe("50");
    expect(params.get("role")).toBe("AGENT");
    expect(params.get("search")).toBe("ana");
    expect(params.get("includeDeleted")).toBe("true");
  });

  it("descarta ADMIN_MASTER no filtro de papel", async () => {
    // Nenhum usuário de company o carrega, e o backend recusaria a query.
    await get("?role=ADMIN_MASTER");

    expect(calledUrl().searchParams.has("role")).toBe(false);
  });

  it("escapa um companyId que não é UUID em vez de montar caminho torto", async () => {
    await GET(
      new NextRequest("http://localhost:3001/x"),
      { params: Promise.resolve({ companyId: "../../users" }) },
    );

    expect(calledUrl().pathname).toBe("/platform/companies/..%2F..%2Fusers/users");
  });
});

describe("POST /api/platform/companies/[companyId]/users", () => {
  function post(body: unknown): Promise<Response> {
    return POST(
      new Request("http://localhost:3001/api/platform/companies/c1/users", {
        method: "POST",
        body: JSON.stringify(body),
      }),
      context,
    );
  }

  it("cria dentro da company do caminho, sem mandar tenantId", async () => {
    // Nenhuma tela envia tenant: o backend o deriva do caminho.
    fetchMock.mockResolvedValue(Response.json({ id: "u9" }, { status: 201 }));

    await post({ email: "agent@acme.example", password: "a-long-enough-one", role: "AGENT" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe("/platform/companies/c1/users");
    expect(parseRequestBody(init)).toEqual({
      email: "agent@acme.example",
      password: "a-long-enough-one",
      role: "AGENT",
    });
  });

  it("recusa sem email ou senha antes de chamar a API", async () => {
    const response = await post({ role: "AGENT" });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

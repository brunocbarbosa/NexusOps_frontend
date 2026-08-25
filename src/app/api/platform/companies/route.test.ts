/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";

import { parseRequestBody } from "../../../../test/http";
import { GET, POST } from "./route";

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
  jar.set("nexusops_at", "access-1");
  jar.set("nexusops_rt", "refresh-1");
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(Response.json({ data: [], meta: { total: 0 } }));
  globalThis.fetch = fetchMock;
});

function calledUrl(): URL {
  const [url] = fetchMock.mock.calls[0] as [string];

  return new URL(url);
}

function get(query: string): Promise<Response> {
  return GET(
    new NextRequest(`http://localhost:3001/api/platform/companies${query}`),
  );
}

describe("GET /api/platform/companies", () => {
  it("repassa paginação e busca", async () => {
    await get("?page=3&perPage=50&search=acme");

    const params = calledUrl().searchParams;
    expect(params.get("page")).toBe("3");
    expect(params.get("perPage")).toBe("50");
    expect(params.get("search")).toBe("acme");
  });

  it("limita perPage ao teto de 100 — 101 é 400 no backend, não um clamp", async () => {
    await get("?perPage=250");

    expect(calledUrl().searchParams.get("perPage")).toBe("100");
  });

  it("repassa isActive como texto, nos dois valores", async () => {
    await get("?isActive=false");
    expect(calledUrl().searchParams.get("isActive")).toBe("false");

    fetchMock.mockClear();
    await get("?isActive=true");
    expect(calledUrl().searchParams.get("isActive")).toBe("true");
  });

  it("omite isActive quando a UI pede 'as duas' — não existe valor para isso", async () => {
    // `''` e `'all'` são 400 lá. "Ambas" se diz ausentando o parâmetro.
    for (const value of ["", "all", "sim"]) {
      fetchMock.mockClear();
      await get(`?isActive=${value}`);
      expect(calledUrl().searchParams.has("isActive")).toBe(false);
    }
  });

  it("descarta parâmetro desconhecido, que o backend recusaria com 400", async () => {
    await get("?tenantId=x&sort=name");

    expect(calledUrl().search).toBe("");
  });

  it("devolve 401 sem sessão, sem chamar a API", async () => {
    jar.reset();

    const response = await get("");

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/platform/companies", () => {
  function post(body: unknown): Promise<Response> {
    return POST(
      new Request("http://localhost:3001/api/platform/companies", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  }

  const valid = {
    name: "Acme Industries",
    domain: "acme.example",
    admin: { email: "admin@acme.example", password: "a-long-enough-password" },
  };

  it("monta o corpo aninhado que a API espera", async () => {
    fetchMock.mockResolvedValue(Response.json({ company: {}, admin: {} }, { status: 201 }));

    await post(valid);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(parseRequestBody(init)).toEqual(valid);
  });

  it("descarta campo que nenhum DTO declara — extra é 400, não ignorado", async () => {
    fetchMock.mockResolvedValue(Response.json({ company: {}, admin: {} }, { status: 201 }));

    await post({ ...valid, isPlatform: true, id: "roubado" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(parseRequestBody(init)).toEqual(valid);
  });

  it("recusa sem administrador antes de chamar a API", async () => {
    // Uma company sem ADMIN é uma em que ninguém entra e ninguém cria o
    // primeiro usuário — a API não a deixa existir, e nem vale a viagem.
    const response = await post({ name: "Acme", domain: "acme.example" });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("recusa sem nome ou domínio antes de chamar a API", async () => {
    const response = await post({ admin: valid.admin });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("repassa o 409 de domínio duplicado com a mensagem intacta", async () => {
    const message = 'The domain "acme.example" is already registered';
    fetchMock.mockResolvedValue(
      Response.json({ message, error: "Conflict", statusCode: 409 }, { status: 409 }),
    );

    const response = await post(valid);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ message });
  });

  it("repassa o 403 de papel insuficiente", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { message: "This route requires one of: ADMIN_MASTER", error: "Forbidden", statusCode: 403 },
        { status: 403 },
      ),
    );

    const response = await post(valid);

    expect(response.status).toBe(403);
  });
});

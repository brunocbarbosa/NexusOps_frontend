/**
 * @jest-environment node
 */
import { GET } from "./route";

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

const context = { params: Promise.resolve({ id: "t1" }) };

const author = {
  id: "u1",
  email: "req@acme.com",
  role: "REQUESTER",
  createdAt: "2026-08-01T00:00:00.000Z",
  deletedAt: null,
};

function page(data: unknown[], meta: { page: number; totalPages: number }) {
  return {
    data,
    meta: { total: data.length, perPage: 100, ...meta },
  };
}

/** Responde por rota, deixando cada lista com a própria paginação. */
function serve(timeline: unknown[][], comments: unknown[][]) {
  fetchMock.mockImplementation((url: string) => {
    const parsed = new URL(url);
    const pages = parsed.pathname.endsWith("/timeline") ? timeline : comments;
    const index = Number(parsed.searchParams.get("page") ?? "1") - 1;

    return Promise.resolve(
      Response.json(
        page(pages[index] ?? [], { page: index + 1, totalPages: pages.length }),
      ),
    );
  });
}

async function get(): Promise<Response> {
  return GET(new Request("http://localhost:3001/api/tickets/t1/history"), context);
}

describe("GET /api/tickets/:id/history", () => {
  it("busca as duas rotas e devolve uma lista só", async () => {
    serve(
      [[{ id: "a1", action: "created", newValues: {}, createdAt: "2026-09-01T09:00:00.000Z", user: author }]],
      [[{ id: "c1", ticketId: "t1", body: "oi", isInternal: false, author, createdAt: "2026-09-01T10:00:00.000Z" }]],
    );

    const response = await get();
    const body = (await response.json()) as { data: unknown[]; truncated: boolean };

    const paths = fetchMock.mock.calls.map(([url]: [string]) => new URL(url).pathname);
    expect(paths).toEqual(
      expect.arrayContaining(["/tickets/t1/timeline", "/tickets/t1/comments"]),
    );
    expect(body.data).toHaveLength(2);
    expect(body.truncated).toBe(false);
  });

  it("pede as duas listas com perPage no teto do backend", async () => {
    serve([[]], [[]]);

    await get();

    for (const [url] of fetchMock.mock.calls as [string][]) {
      expect(new URL(url).searchParams.get("perPage")).toBe("100");
    }
  });

  it("pagina até o fim de cada lista", async () => {
    serve(
      [
        [{ id: "a1", action: "created", newValues: {}, createdAt: "2026-09-01T09:00:00.000Z", user: author }],
        [{ id: "a2", action: "status_changed", newValues: {}, createdAt: "2026-09-01T09:30:00.000Z", user: author }],
      ],
      [[]],
    );

    const body = (await (await get()).json()) as { data: unknown[] };

    expect(body.data).toHaveLength(2);
  });

  it("para no teto de páginas e avisa que truncou", async () => {
    // Um chamado patológico não pode virar uma resposta sem limite. Truncar em
    // silêncio seria pior: a tela mostraria um histórico incompleto como se
    // fosse completo.
    const many = Array.from({ length: 25 }, (_unused, index) => [
      {
        id: `a${String(index)}`,
        action: "created",
        newValues: {},
        createdAt: `2026-09-01T09:00:${String(index).padStart(2, "0")}.000Z`,
        user: author,
      },
    ]);
    serve(many, [[]]);

    const body = (await (await get()).json()) as { data: unknown[]; truncated: boolean };

    expect(body.truncated).toBe(true);
    expect(body.data).toHaveLength(20);
  });

  it("repassa o 404 de um chamado que não é visível, sem inventar um feed vazio", async () => {
    // A timeline resolve o chamado antes: ela não é um canal lateral para os
    // chamados que a listagem esconde. Um 200 com lista vazia diria que o
    // chamado existe e está sem histórico.
    fetchMock.mockResolvedValue(
      Response.json(
        { message: "No ticket t1", error: "Not Found", statusCode: 404 },
        { status: 404 },
      ),
    );

    const response = await get();

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ message: "No ticket t1" });
  });

  it("devolve 401 sem sessão, sem chamar a API", async () => {
    jar.reset();

    const response = await get();

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

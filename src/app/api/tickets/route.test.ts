/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";

import { parseRequestBody } from "../../../test/http";
import { GET, POST } from "./route";

jest.mock("next/headers", () => {
  const { cookieJar: jar } = jest.requireActual<
    typeof import("../../../test/cookie-jar")
  >("../../../test/cookie-jar");

  return { cookies: () => Promise.resolve(jar) };
});

import { cookieJar as jar } from "../../../test/cookie-jar";

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
  return GET(new NextRequest(`http://localhost:3001/api/tickets${query}`));
}

describe("GET /api/tickets", () => {
  it("repassa paginação, busca e os três filtros de enum", async () => {
    await get("?page=3&perPage=50&search=printer&status=OPEN&priority=HIGH&category=HARDWARE");

    const params = calledUrl().searchParams;
    expect(params.get("page")).toBe("3");
    expect(params.get("perPage")).toBe("50");
    expect(params.get("search")).toBe("printer");
    expect(params.get("status")).toBe("OPEN");
    expect(params.get("priority")).toBe("HIGH");
    expect(params.get("category")).toBe("HARDWARE");
  });

  it("descarta enum que não pertence ao contrato, que o backend recusaria com 400", async () => {
    await get("?status=ABERTO&priority=CRITICAL&category=PRINTER");

    expect(calledUrl().search).toBe("");
  });

  it("traduz assignee=<id> para assigneeId", async () => {
    await get("?assignee=8f1c4d2e-0000-4000-8000-000000000001");

    const params = calledUrl().searchParams;
    expect(params.get("assigneeId")).toBe("8f1c4d2e-0000-4000-8000-000000000001");
    expect(params.has("unassigned")).toBe(false);
  });

  it("traduz assignee=unassigned para unassigned=true", async () => {
    await get("?assignee=unassigned");

    const params = calledUrl().searchParams;
    expect(params.get("unassigned")).toBe("true");
    expect(params.has("assigneeId")).toBe(false);
  });

  it("nunca manda unassigned e assigneeId juntos", async () => {
    // Os dois se contradizem e o backend responde 400
    // ("unassigned and assigneeId contradict each other"). O filtro é um campo
    // só na UI justamente para que esta requisição não seja construível.
    await get("?assignee=unassigned&assigneeId=8f1c4d2e-0000-4000-8000-000000000001&unassigned=false");

    const params = calledUrl().searchParams;
    expect(params.get("unassigned")).toBe("true");
    expect(params.has("assigneeId")).toBe(false);
  });

  it("descarta parâmetro desconhecido e ordenação, que não existe na API", async () => {
    await get("?tenantId=outro&sort=createdAt&order=asc&requesterId=alguem");

    expect(calledUrl().search).toBe("");
  });

  it("limita perPage ao teto de 100 do backend", async () => {
    await get("?perPage=500");

    expect(calledUrl().searchParams.get("perPage")).toBe("100");
  });

  it("devolve 401 sem sessão, sem chamar a API", async () => {
    jar.reset();

    const response = await get("");

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/tickets", () => {
  function post(body: unknown): Promise<Response> {
    return POST(
      new Request("http://localhost:3001/api/tickets", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  }

  function sentBody(): unknown {
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    return parseRequestBody(init);
  }

  beforeEach(() => {
    fetchMock.mockResolvedValue(Response.json({ id: "t1" }, { status: 201 }));
  });

  it("manda os quatro campos que a rota aceita", async () => {
    await post({
      title: "Printer on the 3rd floor is jammed",
      description: "It jams on every duplex job.",
      priority: "HIGH",
      category: "HARDWARE",
    });

    expect(sentBody()).toEqual({
      title: "Printer on the 3rd floor is jammed",
      description: "It jams on every duplex job.",
      priority: "HIGH",
      category: "HARDWARE",
    });
  });

  it("omite prioridade e categoria quando não escolhidas — o backend tem default", async () => {
    await post({ title: "Printer jammed" });

    expect(sentBody()).toEqual({ title: "Printer jammed" });
  });

  it("não repassa campo que nenhum DTO declara", async () => {
    // O ValidationPipe roda com forbidNonWhitelisted: um `status` ou um
    // `requesterId` ecoado pela UI reprovaria a requisição inteira com 400.
    await post({ title: "Printer jammed", status: "CLOSED", requesterId: "u9", tenantId: "x" });

    expect(sentBody()).toEqual({ title: "Printer jammed" });
  });

  it("recusa sem título, sem chamar a API", async () => {
    const response = await post({ description: "sem título" });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("descarta prioridade e categoria fora do contrato em vez de deixar virar 400", async () => {
    await post({ title: "Printer jammed", priority: "CRITICAL", category: "PRINTER" });

    expect(sentBody()).toEqual({ title: "Printer jammed" });
  });
});

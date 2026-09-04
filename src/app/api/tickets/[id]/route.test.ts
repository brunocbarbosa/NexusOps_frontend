/**
 * @jest-environment node
 */
import { parseRequestBody } from "../../../../test/http";
import { GET, PATCH } from "./route";

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
  fetchMock.mockResolvedValue(Response.json({ id: "t1", version: 2 }));
  globalThis.fetch = fetchMock;
});

const context = { params: Promise.resolve({ id: "t1" }) };

function sentBody(): unknown {
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];

  return parseRequestBody(init);
}

function patch(body: unknown): Promise<Response> {
  return PATCH(
    new Request("http://localhost:3001/api/tickets/t1", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    context,
  );
}

describe("GET /api/tickets/:id", () => {
  it("busca o chamado pelo id", async () => {
    await GET(new Request("http://localhost:3001/api/tickets/t1"), context);

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(new URL(url).pathname).toBe("/tickets/t1");
  });

  it("repassa o 404 de um chamado que não é visível para quem pergunta", async () => {
    // 404 e não 403: o backend não confirma que o id existe em algum lugar.
    fetchMock.mockResolvedValue(
      Response.json(
        { message: "No ticket t1", error: "Not Found", statusCode: 404 },
        { status: 404 },
      ),
    );

    const response = await GET(new Request("http://localhost:3001/api/tickets/t1"), context);

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/tickets/:id", () => {
  it("manda os campos editáveis junto da versão", async () => {
    await patch({
      title: "Printer jammed again",
      description: "Now on simplex too.",
      priority: "URGENT",
      category: "HARDWARE",
      version: 3,
    });

    expect(sentBody()).toEqual({
      title: "Printer jammed again",
      description: "Now on simplex too.",
      priority: "URGENT",
      category: "HARDWARE",
      version: 3,
    });
  });

  it("recusa sem versão, sem chamar a API", async () => {
    // Sem `version` o backend responde 400 ("version must be an integer
    // number"), que na tela vira um erro de validação sem sentido para quem só
    // editou um título. Barrar aqui é dizer que é bug do chamador.
    const response = await patch({ title: "Printer jammed again" });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("recusa versão que não é inteiro positivo", async () => {
    for (const version of ["3", 0, -1, 2.5, null]) {
      fetchMock.mockClear();
      const response = await patch({ title: "x", version });

      expect(response.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    }
  });

  it("recusa quando não há nada além da versão para atualizar", async () => {
    const response = await patch({ version: 3 });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("deixa esvaziar a descrição", async () => {
    // String vazia é uma edição legítima — apagar o texto. `if (description)`
    // a trataria como ausência e o campo nunca seria limpo.
    await patch({ description: "", version: 3 });

    expect(sentBody()).toEqual({ description: "", version: 3 });
  });

  it("não repassa campo que a rota não aceita", async () => {
    // `status` e `assigneeId` têm rotas próprias, com papel exigido. Aceitá-los
    // aqui não os faria funcionar: seria 400 por campo não declarado.
    await patch({ title: "x", status: "CLOSED", assigneeId: "u9", version: 3 });

    expect(sentBody()).toEqual({ title: "x", version: 3 });
  });

  it("repassa o 409 de conflito com a mensagem intacta, que carrega a versão atual", async () => {
    const message =
      "This ticket was changed by someone else (it is now at version 4). Reload it and reapply your change.";
    fetchMock.mockResolvedValue(
      Response.json({ message, error: "Conflict", statusCode: 409 }, { status: 409 }),
    );

    const response = await patch({ title: "x", version: 3 });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ message });
  });
});

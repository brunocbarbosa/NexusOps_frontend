/**
 * @jest-environment node
 */
import { parseRequestBody } from "../../../../../test/http";
import { PATCH } from "./route";

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
  fetchMock.mockResolvedValue(Response.json({ id: "t1", version: 4 }));
  globalThis.fetch = fetchMock;
});

const context = { params: Promise.resolve({ id: "t1" }) };

function patch(body: unknown): Promise<Response> {
  return PATCH(
    new Request("http://localhost:3001/api/tickets/t1/status", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    context,
  );
}

describe("PATCH /api/tickets/:id/status", () => {
  it("manda o status e a versão para a rota certa", async () => {
    await patch({ status: "IN_PROGRESS", version: 3 });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe("/tickets/t1/status");
    expect(parseRequestBody(init)).toEqual({ status: "IN_PROGRESS", version: 3 });
  });

  it("recusa status fora do contrato, sem chamar a API", async () => {
    const response = await patch({ status: "ARQUIVADO", version: 3 });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("recusa sem versão", async () => {
    const response = await patch({ status: "RESOLVED" });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("repassa o 409 de transição ilegal como veio", async () => {
    // É 409 e **não** é conflito de versão: recarregar não ajudaria. A tela
    // distingue os dois pela mensagem.
    const message = "A ticket cannot go from RESOLVED to IN_PROGRESS";
    fetchMock.mockResolvedValue(
      Response.json({ message, error: "Conflict", statusCode: 409 }, { status: 409 }),
    );

    const response = await patch({ status: "IN_PROGRESS", version: 3 });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ message });
  });

  it("repassa o 403 de quem não é ADMIN nem AGENT", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { message: "This route requires one of: ADMIN, AGENT", error: "Forbidden", statusCode: 403 },
        { status: 403 },
      ),
    );

    const response = await patch({ status: "RESOLVED", version: 3 });

    expect(response.status).toBe(403);
  });
});

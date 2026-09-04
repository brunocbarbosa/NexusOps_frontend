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
    new Request("http://localhost:3001/api/tickets/t1/assignee", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    context,
  );
}

function sentBody(): unknown {
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];

  return parseRequestBody(init);
}

describe("PATCH /api/tickets/:id/assignee", () => {
  it("atribui a alguém", async () => {
    await patch({ assigneeId: "u9", version: 3 });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(new URL(url).pathname).toBe("/tickets/t1/assignee");
    expect(sentBody()).toEqual({ assigneeId: "u9", version: 3 });
  });

  it("desatribui com null explícito", async () => {
    // `null` é o valor que **remove** o responsável, não a ausência do campo.
    // Um `pickStrings` o descartaria e o PATCH viraria "nada para atualizar".
    await patch({ assigneeId: null, version: 3 });

    expect(sentBody()).toEqual({ assigneeId: null, version: 3 });
  });

  it("recusa quando o campo nem foi enviado", async () => {
    const response = await patch({ version: 3 });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("recusa sem versão", async () => {
    const response = await patch({ assigneeId: "u9" });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("repassa o 409 de quem não pode receber chamado", async () => {
    const message =
      "req@capture.example is a REQUESTER and cannot be assigned a ticket. Only an AGENT or an ADMIN works tickets.";
    fetchMock.mockResolvedValue(
      Response.json({ message, error: "Conflict", statusCode: 409 }, { status: 409 }),
    );

    const response = await patch({ assigneeId: "u9", version: 3 });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ message });
  });
});

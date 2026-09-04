/**
 * @jest-environment node
 */
import { parseRequestBody } from "../../../../../test/http";
import { POST } from "./route";

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
  fetchMock.mockResolvedValue(Response.json({ id: "c1" }, { status: 201 }));
  globalThis.fetch = fetchMock;
});

const context = { params: Promise.resolve({ id: "t1" }) };

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost:3001/api/tickets/t1/comments", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    context,
  );
}

function sentBody(): unknown {
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];

  return parseRequestBody(init);
}

describe("POST /api/tickets/:id/comments", () => {
  it("manda o corpo do comentário", async () => {
    await post({ body: "Still jamming this morning." });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(new URL(url).pathname).toBe("/tickets/t1/comments");
    expect(sentBody()).toEqual({ body: "Still jamming this morning." });
  });

  it("manda isInternal como booleano de verdade", async () => {
    await post({ body: "Waiting on the vendor.", isInternal: true });

    expect(sentBody()).toEqual({ body: "Waiting on the vendor.", isInternal: true });
  });

  it("descarta um isInternal que não é booleano", async () => {
    // Medido no backend: `enableImplicitConversion` converte o corpo JSON pelo
    // tipo **declarado**, não pelo valor. Antes da correção, `"false"` virava
    // `true` e um comentário visível saía como nota interna. O handler manda
    // booleano ou não manda nada.
    for (const isInternal of ["true", "false", "yes", 1, 0, null]) {
      fetchMock.mockClear();
      await post({ body: "x", isInternal });

      expect(sentBody()).toEqual({ body: "x" });
    }
  });

  it("recusa comentário vazio, sem chamar a API", async () => {
    const response = await post({ body: "   " });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("repassa o 403 de nota interna pedida por um REQUESTER", async () => {
    // 403 e não 404: o chamado é dele e está visível; o que falta é só o papel.
    fetchMock.mockResolvedValue(
      Response.json(
        {
          message: "Only an ADMIN or an AGENT can leave an internal note",
          error: "Forbidden",
          statusCode: 403,
        },
        { status: 403 },
      ),
    );

    const response = await post({ body: "x", isInternal: true });

    expect(response.status).toBe(403);
  });

  it("repassa o 409 de chamado fechado", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ message: "This ticket is closed", error: "Conflict", statusCode: 409 }, { status: 409 }),
    );

    const response = await post({ body: "x" });

    expect(response.status).toBe(409);
  });
});

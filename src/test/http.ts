/**
 * Respostas de mentira para os testes de componente.
 *
 * O jsdom não implementa a Fetch API, então `Response` não existe nesse
 * ambiente — e o que os componentes precisam de uma resposta é pequeno:
 * `ok`, `status`, `json()` e `text()`. Testes de Route Handler rodam em
 * ambiente node e usam a `Response` de verdade.
 */
export function jsonResponse(body: unknown, status = 200): Response {
  const payload = JSON.stringify(body);

  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Map([["content-type", "application/json"]]),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(payload),
  } as unknown as Response;
}

export function emptyResponse(status = 204): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.reject(new Error("no body")),
    text: () => Promise.resolve(""),
  } as unknown as Response;
}

/** O `body` de um `RequestInit` é `BodyInit | null`; nestes testes é sempre JSON. */
export function parseRequestBody(init: RequestInit): unknown {
  return JSON.parse(init.body as string);
}

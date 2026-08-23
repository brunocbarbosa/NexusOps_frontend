import { ApiError, apiErrorFromResponse } from "./errors";

/**
 * Cliente do browser. Fala **só** com os Route Handlers deste projeto, nunca
 * com o NestJS: o token está num cookie `httpOnly` que este código não alcança,
 * e é exatamente assim que deve ser.
 */

export async function fetchJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await request(path, init);

  const body: unknown = await response.json();

  return body as T;
}

/** Para as rotas que respondem 204 — logout, desativar, trocar senha. */
export async function fetchVoid(
  path: string,
  init?: RequestInit,
): Promise<void> {
  await request(path, init);
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  let response: Response;

  try {
    response = await fetch(path, {
      ...init,
      headers:
        init?.body === undefined
          ? init?.headers
          : { "content-type": "application/json", ...init?.headers },
    });
  } catch {
    // Rede caiu ou o servidor não respondeu. Um `ApiError` de status 0
    // mantém um único tipo de erro para a UI tratar.
    throw new ApiError(0, ["Could not reach the server. Check your connection."]);
  }

  if (!response.ok) {
    throw await apiErrorFromResponse(response);
  }

  return response;
}

export function jsonBody(value: unknown): RequestInit {
  return { body: JSON.stringify(value) };
}

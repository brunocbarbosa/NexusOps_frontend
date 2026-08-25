import { SessionExpiredError } from "./errors";
import { apiFetch, type ApiFetchInit } from "./server";

/**
 * A ponte entre um Route Handler e o `apiFetch`.
 *
 * Repassa status e corpo do NestJS como vieram — inclusive os erros, cujo
 * `message` a UI precisa ler (o 409 que diz qual usuário desativado ocupa o
 * email é o caso motivador). O que este módulo acrescenta é o tratamento das
 * duas falhas que o backend não produz: sessão vencida e API fora do ar.
 */
export async function proxyToApi(
  path: string,
  init: ApiFetchInit = {},
): Promise<Response> {
  try {
    const response = await apiFetch(path, init);

    if (response.status === 204) {
      return new Response(null, { status: 204 });
    }

    const body = await response.text();

    return new Response(body.length > 0 ? body : null, {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof SessionExpiredError) {
    return jsonError(401, error.message);
  }

  // `fetch` só rejeita por falha de rede; erro HTTP vem como resposta. Um 502
  // aqui é honesto: este servidor está de pé, o de trás não respondeu.
  return jsonError(502, "The NexusOps API is unreachable.");
}

export function jsonError(status: number, message: string): Response {
  return Response.json({ message, statusCode: status }, { status });
}

/**
 * Normalização do envelope de erro do NestJS.
 *
 * O backend responde `{ message, error, statusCode }`, e `message` é **string**
 * para erro de negócio e **array de strings** para falha de validação. Há ainda
 * duas exceções documentadas: token ausente ou inválido devolve
 * `{"message":"Unauthorized","statusCode":401}` sem a chave `error`, e um 204
 * não tem corpo nenhum.
 *
 * Quem consome a API nunca deve reimplementar essa distinção — daí este módulo.
 */

export class ApiError extends Error {
  readonly status: number;

  /** Todas as mensagens do backend. Uma para erro de negócio, N para validação. */
  readonly messages: string[];

  constructor(status: number, messages: string[]) {
    super(messages[0] ?? `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.messages = messages;
  }
}

/** A sessão acabou: o refresh falhou ou nunca houve cookie. */
export class SessionExpiredError extends ApiError {
  constructor(message = "Your session has expired. Please sign in again.") {
    super(401, [message]);
    this.name = "SessionExpiredError";
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Extrai as mensagens de um corpo de erro do Nest, aceitando as duas formas de
 * `message` e caindo para um texto genérico quando o corpo não é o envelope
 * esperado (um 502 de gateway, uma página HTML de proxy).
 */
export function messagesFromBody(body: unknown, status: number): string[] {
  if (typeof body === "object" && body !== null && "message" in body) {
    const message: unknown = body.message;

    if (typeof message === "string" && message.length > 0) {
      return [message];
    }

    if (Array.isArray(message)) {
      const texts = message.filter(
        (item): item is string => typeof item === "string",
      );
      if (texts.length > 0) {
        return texts;
      }
    }
  }

  return [`Request failed with status ${status}`];
}

/** Lê o corpo uma única vez e monta o `ApiError`. Nunca lança. */
export async function apiErrorFromResponse(response: Response): Promise<ApiError> {
  let body: unknown = null;

  try {
    const text = await response.text();
    body = text.length > 0 ? (JSON.parse(text) as unknown) : null;
  } catch {
    body = null;
  }

  return new ApiError(response.status, messagesFromBody(body, response.status));
}

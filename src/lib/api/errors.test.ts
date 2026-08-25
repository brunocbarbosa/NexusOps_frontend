/**
 * `Response` é da Fetch API, que o jsdom não define — o ambiente node é o que
 * este módulo realmente exercita: ele roda dentro dos Route Handlers.
 *
 * @jest-environment node
 */
import {
  ApiError,
  apiErrorFromResponse,
  isApiError,
  messagesFromBody,
  SessionExpiredError,
} from "./errors";

describe("messagesFromBody", () => {
  it("lê o `message` string dos erros de negócio", () => {
    expect(
      messagesFromBody(
        { message: "This user is already deactivated", error: "Conflict", statusCode: 409 },
        409,
      ),
    ).toEqual(["This user is already deactivated"]);
  });

  it("lê o `message` array das falhas de validação", () => {
    expect(
      messagesFromBody(
        { message: ["property tenantId should not exist"], error: "Bad Request", statusCode: 400 },
        400,
      ),
    ).toEqual(["property tenantId should not exist"]);
  });

  it("lê o 401 de token inválido, que vem sem a chave `error`", () => {
    expect(messagesFromBody({ message: "Unauthorized", statusCode: 401 }, 401)).toEqual([
      "Unauthorized",
    ]);
  });

  it("cai para um texto genérico quando o corpo não é o envelope do Nest", () => {
    expect(messagesFromBody("<html>502 Bad Gateway</html>", 502)).toEqual([
      "Request failed with status 502",
    ]);
    expect(messagesFromBody(null, 500)).toEqual(["Request failed with status 500"]);
  });
});

describe("apiErrorFromResponse", () => {
  it("monta o erro a partir da resposta", async () => {
    const response = new Response(
      JSON.stringify({ message: "Invalid credentials", error: "Unauthorized", statusCode: 401 }),
      { status: 401 },
    );

    const error = await apiErrorFromResponse(response);

    expect(error.status).toBe(401);
    expect(error.message).toBe("Invalid credentials");
    expect(isApiError(error)).toBe(true);
  });

  it("não quebra com corpo vazio ou não-JSON", async () => {
    const error = await apiErrorFromResponse(new Response("", { status: 500 }));

    expect(error.status).toBe(500);
    expect(error.message).toBe("Request failed with status 500");
  });
});

describe("ApiError", () => {
  it("preserva todas as mensagens de validação", () => {
    const error = new ApiError(400, ["email must be an email", "password is too short"]);

    expect(error.messages).toHaveLength(2);
    expect(error.message).toBe("email must be an email");
  });

  it("SessionExpiredError é um ApiError 401", () => {
    const error = new SessionExpiredError();

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(401);
  });
});

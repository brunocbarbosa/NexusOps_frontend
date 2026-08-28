/**
 * @jest-environment node
 */
import { ConfigurationError, SessionExpiredError } from "./errors";
import { errorResponse } from "./route-proxy";

describe("errorResponse", () => {
  let logged: jest.SpyInstance;

  beforeEach(() => {
    logged = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logged.mockRestore();
  });

  it("devolve 401 quando a sessão venceu", async () => {
    const response = errorResponse(new SessionExpiredError());

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ statusCode: 401 });
  });

  it("devolve 502 quando a API não respondeu", async () => {
    const response = errorResponse(new TypeError("fetch failed"));

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      message: "The NexusOps API is unreachable.",
    });
  });

  it("devolve 500, não 502, quando falta configuração — a API nem chegou a ser procurada", () => {
    const response = errorResponse(
      new ConfigurationError("NEXUSOPS_API_URL is not set."),
    );

    expect(response.status).toBe(500);
  });

  it("não vaza o nome da variável de ambiente para o browser", async () => {
    const response = errorResponse(
      new ConfigurationError("NEXUSOPS_API_URL is not set."),
    );

    expect(JSON.stringify(await response.json())).not.toMatch(/NEXUSOPS_API_URL/);
  });

  it("registra o detalhe da má configuração no log do servidor", () => {
    errorResponse(new ConfigurationError("NEXUSOPS_API_URL is not set."));

    expect(logged).toHaveBeenCalled();
    expect(JSON.stringify(logged.mock.calls)).toMatch(/NEXUSOPS_API_URL/);
  });
});

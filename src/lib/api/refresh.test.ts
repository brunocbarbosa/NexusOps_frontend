/**
 * @jest-environment node
 */
import { __resetRefreshFlights, refreshTokens } from "./refresh";
import { ApiError } from "./errors";

const fetchMock = jest.fn();

beforeEach(() => {
  __resetRefreshFlights();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
});

function pairResponse(suffix: string, delayMs = 0): Promise<Response> {
  const response = Response.json({
    accessToken: `access-${suffix}`,
    refreshToken: `refresh-${suffix}`,
    user: { id: "u1", email: "admin@acme.com", role: "ADMIN" },
  });

  return delayMs === 0
    ? Promise.resolve(response)
    : new Promise((resolve) => setTimeout(() => resolve(response), delayMs));
}

describe("refreshTokens", () => {
  it("devolve o novo par", async () => {
    fetchMock.mockReturnValue(pairResponse("2"));

    await expect(refreshTokens("refresh-1")).resolves.toEqual({
      accessToken: "access-2",
      refreshToken: "refresh-2",
    });
  });

  it("serializa: cinco chamadas concorrentes com o mesmo token fazem UMA requisição", async () => {
    // O ponto da fatia. O backend detecta reuso de refresh token e revoga a
    // família inteira — duas renovações em paralelo deslogariam o usuário de
    // todos os lugares.
    fetchMock.mockReturnValue(pairResponse("2", 10));

    const results = await Promise.all([
      refreshTokens("refresh-1"),
      refreshTokens("refresh-1"),
      refreshTokens("refresh-1"),
      refreshTokens("refresh-1"),
      refreshTokens("refresh-1"),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new Set(results.map((pair) => pair.accessToken)).size).toBe(1);
  });

  it("não serializa tokens diferentes: são sessões diferentes", async () => {
    fetchMock.mockImplementation(() => pairResponse("2", 5));

    await Promise.all([refreshTokens("refresh-a"), refreshTokens("refresh-b")]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("lembra do par para quem chega DEPOIS com o token antigo", async () => {
    // O caso que derrubava a sessão contra o backend real: o browser dispara
    // duas requisições juntas, mas elas chegam escalonadas. A segunda ainda
    // carrega o cookie velho, porque o Set-Cookie da primeira não voltou —
    // e reapresentar um refresh token gasto revoga a família inteira.
    fetchMock.mockImplementation(() => pairResponse("2"));

    const first = await refreshTokens("refresh-1");
    const second = await refreshTokens("refresh-1");
    const third = await refreshTokens("refresh-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  it("renova de novo quando a janela de tolerância passa", async () => {
    jest.useFakeTimers();
    try {
      fetchMock.mockImplementation(() => pairResponse("2"));
      await refreshTokens("refresh-1");

      jest.advanceTimersByTime(31_000);

      fetchMock.mockImplementation(() => pairResponse("3"));
      await expect(refreshTokens("refresh-1")).resolves.toEqual({
        accessToken: "access-3",
        refreshToken: "refresh-3",
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it("propaga o 401 do backend e não guarda nada — só sucesso vira memória", async () => {
    fetchMock.mockReturnValue(
      Promise.resolve(
        Response.json({ message: "Invalid refresh token", statusCode: 401 }, { status: 401 }),
      ),
    );

    await expect(refreshTokens("refresh-1")).rejects.toBeInstanceOf(ApiError);

    fetchMock.mockReturnValue(pairResponse("2"));
    await expect(refreshTokens("refresh-1")).resolves.toHaveProperty(
      "accessToken",
      "access-2",
    );
  });

  it("manda o token no corpo, para a rota pública de refresh", async () => {
    fetchMock.mockReturnValue(pairResponse("2"));

    await refreshTokens("refresh-1");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/auth\/refresh$/);
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ refreshToken: "refresh-1" }));
  });
});

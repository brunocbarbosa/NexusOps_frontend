import { apiBaseUrl } from "./base-url";
import { apiErrorFromResponse } from "./errors";
import type { TokenPair } from "./session";

/**
 * Renovação de sessão, serializada — e com memória.
 *
 * O backend rotaciona o refresh token e **detecta reuso**: apresentar um token
 * já gasto revoga a família inteira, ou seja, todas as sessões do usuário.
 *
 * Duas coisas precisam acontecer para que isso não derrube quem está usando o
 * sistema, e a segunda custou uma sessão de verdade para ser descoberta:
 *
 * 1. **Voos em andamento são compartilhados.** Requisições que chegam enquanto
 *    uma renovação corre recebem a mesma promise, e portanto o mesmo par novo.
 *
 * 2. **O resultado sobrevive ao voo.** Duas requisições disparadas juntas pelo
 *    browser não chegam juntas ao servidor: a segunda pode chegar depois de a
 *    primeira ter renovado — e ela ainda carrega o cookie **antigo**, porque o
 *    `Set-Cookie` da primeira ainda não voltou. Sem memória, essa segunda
 *    reapresenta o token gasto e derruba a sessão inteira. Medido contra o
 *    backend real: de cinco requisições concorrentes, uma passava e quatro
 *    tomavam 401.
 *
 * A janela de tolerância existe por isso: durante ela, o token antigo devolve o
 * par que a renovação anterior já obteve, em vez de bater na API de novo. Não é
 * um segundo login — é o mesmo par que já está no cookie.
 *
 * Limitação consciente: isto vale dentro de **um processo**. Com mais de uma
 * instância do Next atrás de um balanceador seria preciso um estado
 * compartilhado (Redis, por exemplo). Hoje roda uma instância —
 * `documents/specs/2026-08-23-identity-login-users-design.md` §3.2.
 */

/** Tempo em que um token recém-rotacionado ainda responde pelo par novo. */
const GRACE_MS = 30_000;

/** Teto de segurança: a janela já limpa, isto impede crescer sob carga. */
const MAX_REMEMBERED = 500;

interface RotatedPair {
  pair: TokenPair;
  at: number;
}

const inFlight = new Map<string, Promise<TokenPair>>();
const rotated = new Map<string, RotatedPair>();

export function refreshTokens(refreshToken: string): Promise<TokenPair> {
  const recent = rotated.get(refreshToken);
  if (recent && Date.now() - recent.at < GRACE_MS) {
    return Promise.resolve(recent.pair);
  }

  const existing = inFlight.get(refreshToken);
  if (existing) {
    return existing;
  }

  const flight = requestNewPair(refreshToken)
    .then((pair) => {
      remember(refreshToken, pair);
      return pair;
    })
    .finally(() => {
      inFlight.delete(refreshToken);
    });

  inFlight.set(refreshToken, flight);

  return flight;
}

function remember(refreshToken: string, pair: TokenPair): void {
  const now = Date.now();

  for (const [token, entry] of rotated) {
    if (now - entry.at >= GRACE_MS) {
      rotated.delete(token);
    }
  }

  if (rotated.size >= MAX_REMEMBERED) {
    // Mapa em JS itera na ordem de inserção: a primeira chave é a mais velha.
    const oldest = rotated.keys().next();
    if (!oldest.done) {
      rotated.delete(oldest.value);
    }
  }

  rotated.set(refreshToken, { pair, at: now });
}

async function requestNewPair(refreshToken: string): Promise<TokenPair> {
  const response = await fetch(`${apiBaseUrl()}/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw await apiErrorFromResponse(response);
  }

  const body: unknown = await response.json();

  if (!isTokenPair(body)) {
    throw new Error("Unexpected response from POST /auth/refresh");
  }

  return { accessToken: body.accessToken, refreshToken: body.refreshToken };
}

function isTokenPair(body: unknown): body is TokenPair {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof (body as TokenPair).accessToken === "string" &&
    typeof (body as TokenPair).refreshToken === "string"
  );
}

/** Só para os testes: os dois mapas são estado de módulo e sobrevivem entre casos. */
export function __resetRefreshFlights(): void {
  inFlight.clear();
  rotated.clear();
}

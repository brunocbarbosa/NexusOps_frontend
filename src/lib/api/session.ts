import { cookies } from "next/headers";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "./cookie-names";

/**
 * Os dois cookies de sessão, e o único lugar do projeto que os lê ou escreve.
 *
 * `httpOnly` é a decisão central da arquitetura de BFF: token invisível ao
 * JavaScript é token imune a XSS. Guardá-lo em memória do cliente não é.
 */

export { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE };

/** Espelham `JWT_EXPIRES_IN` (15m) e `JWT_REFRESH_EXPIRES_IN` (7d) do backend. */
const ACCESS_TOKEN_MAX_AGE = 60 * 15;
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  // `lax` já barra o envio em requisição cross-site de terceiro, e mantém a
  // sessão viva quando o usuário chega por um link externo.
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

export async function readTokens(): Promise<{
  accessToken?: string;
  refreshToken?: string;
}> {
  const store = await cookies();

  // `|| undefined`, e não `?.value` puro: um cookie apagado pode chegar como
  // string vazia, e `"" ?? fallback` continua sendo `""` — um Bearer vazio que
  // o backend recusa sem que nada aqui perceba que não havia token.
  return {
    accessToken: store.get(ACCESS_TOKEN_COOKIE)?.value || undefined,
    refreshToken: store.get(REFRESH_TOKEN_COOKIE)?.value || undefined,
  };
}

export async function writeTokens(tokens: TokenPair): Promise<void> {
  const store = await cookies();

  store.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
  store.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

export async function clearTokens(): Promise<void> {
  const store = await cookies();

  // `delete` sem as mesmas opções deixa o cookie vivo em produção, onde ele foi
  // gravado com `secure`. Sobrescrever com maxAge 0 é o que apaga de verdade.
  store.set(ACCESS_TOKEN_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  store.set(REFRESH_TOKEN_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
}

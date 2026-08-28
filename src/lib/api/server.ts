import { apiBaseUrl } from "./base-url";
import { ConfigurationError, SessionExpiredError } from "./errors";
import { refreshTokens } from "./refresh";
import { clearTokens, readTokens, writeTokens } from "./session";

/**
 * O único ponto do frontend que fala com o NestJS autenticado.
 *
 * Ser um só lugar é o ponto: um handler que montasse a requisição por conta
 * própria é um handler que pode esquecer o `Authorization`, tentar renovar duas
 * vezes ou devolver o token no corpo da resposta. É o mesmo raciocínio do
 * chokepoint de tenant no backend.
 */

export interface ApiFetchInit {
  method?: string;
  /** Serializado como JSON. `undefined` não manda corpo algum. */
  body?: unknown;
  searchParams?: URLSearchParams;
  /**
   * Renovar a sessão no 401. O logout desliga: renovar para em seguida
   * encerrar a sessão gastaria o refresh token e deixaria o par rotacionado
   * vivo no backend, sem ninguém para usá-lo.
   */
  refreshOnUnauthorized?: boolean;
}

/** Chamada sem autenticação — só `login` e `refresh` são públicas. */
export async function apiFetchPublic(
  path: string,
  init: ApiFetchInit = {},
): Promise<Response> {
  return callApi(path, init, undefined);
}

/**
 * Chamada autenticada, com renovação embutida.
 *
 * **Nem todo 401 é sessão vencida.** O guard do Nest recusa um token ausente ou
 * inválido com exatamente `{"message":"Unauthorized","statusCode":401}` — sem a
 * chave `error`, ao contrário de todo o resto da API. Um 401 com mensagem de
 * verdade é regra de negócio: `PATCH /users/me/password` responde
 * "The current password is incorrect" assim, e renovar a sessão por causa disso
 * gastaria uma rotação de refresh token a cada senha digitada errado.
 *
 * Quando é mesmo o token: renova, regrava os cookies e repete **uma única vez**.
 * Repetir mais entra em laço.
 *
 * Quando a renovação falha, a sessão acabou de verdade (inclusive no caso em
 * que o reuso do token por outra parte revogou a família inteira): os cookies
 * são apagados e sobe `SessionExpiredError`. A única exceção é o
 * `ConfigurationError`, que sobe intacto: ele diz que este servidor está
 * quebrado, e apagar a sessão de quem esbarrou nisso puniria a pessoa errada.
 */
export async function apiFetch(
  path: string,
  init: ApiFetchInit = {},
): Promise<Response> {
  const { accessToken, refreshToken } = await readTokens();

  if (!accessToken && !refreshToken) {
    throw new SessionExpiredError();
  }

  // O cookie de access expira antes do de refresh: sem ele, renovar é o
  // primeiro passo, não a reação a um 401.
  let token = accessToken ?? (await renew(refreshToken)).accessToken;

  const response = await callApi(path, init, token);

  if (response.status !== 401 || init.refreshOnUnauthorized === false) {
    return response;
  }

  // Ler o corpo consome a resposta; se não for o token que foi recusado, ela
  // precisa ser remontada para seguir ao chamador intacta.
  const body = await response.text();

  if (!isTokenRejection(body)) {
    return new Response(body, {
      status: response.status,
      headers: response.headers,
    });
  }

  token = (await renew(refreshToken)).accessToken;

  return callApi(path, init, token);
}

function isTokenRejection(body: string): boolean {
  try {
    const parsed: unknown = JSON.parse(body);

    return (
      typeof parsed === "object" &&
      parsed !== null &&
      "message" in parsed &&
      parsed.message === "Unauthorized"
    );
  } catch {
    // Um 401 sem corpo JSON não veio do Nest. Tratar como recusa de token é o
    // lado seguro: no pior caso gasta uma renovação.
    return true;
  }
}

async function renew(refreshToken: string | undefined) {
  if (!refreshToken) {
    await clearTokens();
    throw new SessionExpiredError();
  }

  try {
    const pair = await refreshTokens(refreshToken);
    await writeTokens(pair);
    return pair;
  } catch (error) {
    // Servidor mal configurado não é sessão vencida. Sem esta guarda, um
    // `NEXUSOPS_API_URL` ausente apagava os cookies e deslogava o usuário — o
    // dano cai sobre quem não tem como consertá-lo, e o operador perde o
    // sintoma que apontaria para a variável.
    if (error instanceof ConfigurationError) {
      throw error;
    }

    await clearTokens();
    throw new SessionExpiredError();
  }
}

async function callApi(
  path: string,
  init: ApiFetchInit,
  accessToken: string | undefined,
): Promise<Response> {
  const query = init.searchParams?.toString();
  const url = `${apiBaseUrl()}${path}${query ? `?${query}` : ""}`;

  const headers = new Headers();
  if (accessToken) {
    headers.set("authorization", `Bearer ${accessToken}`);
  }
  if (init.body !== undefined) {
    headers.set("content-type", "application/json");
  }

  return fetch(url, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    // Sessão e listagem de usuários nunca vêm do cache do Next: são dados de
    // um tenant específico, e um acerto de cache entre requisições seria
    // vazamento entre empresas.
    cache: "no-store",
  });
}

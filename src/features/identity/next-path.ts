import type { Role } from "./types";

/**
 * O `?next=` do login vem da query string, ou seja, de fora. Devolvê-lo a um
 * `router.replace()` sem checar é um redirecionamento aberto:
 * `/login?next=https://exemplo.invalido` levaria o usuário recém-autenticado
 * para outro site.
 *
 * Só caminho interno passa. `//host` é URL protocolo-relativa, e por isso
 * também é recusado.
 *
 * O fallback é a raiz e não `/users`: quem despacha por papel é `/`, e existem
 * dois consoles.
 */
const FALLBACK = "/";

export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return FALLBACK;
  }

  return value;
}

const PLATFORM_HOME = "/platform/companies";
const COMPANY_HOME = "/tickets";
const PLATFORM_PREFIX = "/platform";

/**
 * Para onde alguém vai depois de entrar.
 *
 * Os papéis **não são hierárquicos**: o operador toma 403 em `/users` e todos os
 * demais tomam 403 em `/platform/**`. Um `?next=` guardado pelo porteiro de
 * rotas não sabe quem viria a entrar — `/platform/companies` protegido manda
 * para `/login?next=/platform/companies`, e um ADMIN que entre ali cairia num
 * 403. Então o destino guardado só é respeitado quando pertence ao console de
 * quem entrou.
 *
 * O papel vem da resposta do login, que o carrega. Não do JWT: a UI nunca o
 * decodifica.
 *
 * A casa de quem é de uma company é `/tickets`, e não `/users`: listar usuários
 * exige ADMIN ou AGENT, então um `REQUESTER` mandado para lá caía num 403 na
 * primeira tela que via. Chamados os três papéis têm.
 */
export function landingPath(role: Role, next: string | null | undefined): string {
  const safe = safeNextPath(next);
  const wantsPlatform =
    safe === PLATFORM_PREFIX || safe.startsWith(`${PLATFORM_PREFIX}/`);

  if (role === "ADMIN_MASTER") {
    return wantsPlatform ? safe : PLATFORM_HOME;
  }

  return wantsPlatform ? COMPANY_HOME : safe === FALLBACK ? COMPANY_HOME : safe;
}

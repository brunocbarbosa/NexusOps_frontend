/**
 * O `?next=` do login vem da query string, ou seja, de fora. Devolvê-lo a um
 * `router.replace()` sem checar é um redirecionamento aberto:
 * `/login?next=https://exemplo.invalido` levaria o usuário recém-autenticado
 * para outro site.
 *
 * Só caminho interno passa. `//host` é URL protocolo-relativa, e por isso
 * também é recusado.
 */
const FALLBACK = "/users";

export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return FALLBACK;
  }

  return value;
}

/**
 * Os nomes dos cookies de sessão, isolados num módulo sem dependências.
 *
 * O `proxy.ts` precisa deles e **não pode** importar `session.ts`: aquele
 * módulo usa `next/headers`, que não existe no runtime do proxy.
 */
export const ACCESS_TOKEN_COOKIE = "nexusops_at";
export const REFRESH_TOKEN_COOKIE = "nexusops_rt";

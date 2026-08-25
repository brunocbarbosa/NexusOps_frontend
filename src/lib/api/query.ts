/**
 * Montagem de query string para o backend.
 *
 * Toda listagem remonta os parâmetros campo a campo em vez de repassar o que o
 * browser mandou: o `ValidationPipe` do Nest recusa parâmetro desconhecido com
 * 400, e vários dos nossos são texto onde pareceriam ser outra coisa.
 */

export function positiveInteger(value: string | null): number | null {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/** Teto do backend. Mandar 101 é **400**, não um clamp silencioso. */
export const MAX_PER_PAGE = 100;

/**
 * `page`, `perPage` e `search` — os três que toda listagem da API aceita, com
 * as mesmas regras em todas elas.
 */
export function paginationSearchParams(incoming: URLSearchParams): URLSearchParams {
  const searchParams = new URLSearchParams();

  const page = positiveInteger(incoming.get("page"));
  if (page) {
    searchParams.set("page", String(page));
  }

  const perPage = positiveInteger(incoming.get("perPage"));
  if (perPage) {
    searchParams.set("perPage", String(Math.min(perPage, MAX_PER_PAGE)));
  }

  const search = incoming.get("search")?.trim();
  if (search) {
    searchParams.set("search", search);
  }

  return searchParams;
}

/**
 * Flag booleana de filtro, que no backend é **texto**.
 *
 * Só `'true'` e `'false'` passam. Qualquer outra coisa — inclusive `''` e
 * `'all'`, que a UI poderia mandar querendo dizer "os dois" — é 400 lá, então
 * "os dois" se diz **omitindo** o parâmetro.
 */
export function setBooleanFilter(
  searchParams: URLSearchParams,
  key: string,
  value: string | null,
): void {
  if (value === "true" || value === "false") {
    searchParams.set(key, value);
  }
}

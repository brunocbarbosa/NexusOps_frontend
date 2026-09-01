/**
 * O envelope de toda listagem da API.
 *
 * Está aqui e não dentro de uma feature porque não pertence a nenhuma: `/users`,
 * `/platform/companies`, `/tickets`, `/tickets/:id/comments` e `/audit`
 * respondem todas `{ data, meta }`, com este mesmo `meta`. Ele morou em
 * `features/identity/types.ts` enquanto identity era a única listagem — e a
 * segunda feature já o importava de dentro da primeira.
 */
export interface PageMeta {
  total: number;
  page: number;
  perPage: number;
  /** Sempre >= 1, mesmo com `total: 0` — a UI renderiza "1 of 1" sem caso especial. */
  totalPages: number;
}

/** `{ data, meta }` — o corpo de qualquer rota paginada. */
export interface Page<T> {
  data: T[];
  meta: PageMeta;
}

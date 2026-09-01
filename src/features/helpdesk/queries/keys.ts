/**
 * Chaves de cache do helpdesk, num só lugar para que a invalidação depois de
 * uma mutação não dependa de alguém repetir o mesmo array à mão.
 *
 * `history` **não** fica aninhada sob `ticket`. Se ficasse, invalidar o chamado
 * arrastaria o histórico junto — e o caminho normal de uma mutação é gravar o
 * chamado com `setQueryData`, sem refetch, justamente para não gastar um GET
 * que a resposta já respondeu.
 */
export const helpdeskKeys = {
  /** Raiz de toda listagem: uma mutação invalida daqui e alcança todo filtro. */
  tickets: ["helpdesk", "tickets"] as const,
  ticket: (id: string) => ["helpdesk", "ticket", id] as const,
  history: (id: string) => ["helpdesk", "history", id] as const,
  staff: ["helpdesk", "staff"] as const,
};

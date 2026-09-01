"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import { fetchJson, jsonBody } from "@/lib/api/client";

import type {
  Ticket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  TicketsPage,
  TicketsQuery,
} from "../types";
import { helpdeskKeys } from "./keys";

/**
 * A trilha de auditoria é escrita **depois** da resposta da mutação, então um
 * GET imediato pode vir uma entrada atrás. Invalidar o histórico com um pequeno
 * atraso é o que o guia recomenda enquanto não há socket — a fatia 2 troca isto
 * pelo evento `ticket.changed`.
 */
const TRAIL_WRITE_DELAY_MS = 500;

export function ticketsSearchParams(query: TicketsQuery, page: number): string {
  const params = new URLSearchParams({
    page: String(page),
    perPage: String(query.perPage),
  });

  if (query.status) {
    params.set("status", query.status);
  }
  if (query.priority) {
    params.set("priority", query.priority);
  }
  if (query.category) {
    params.set("category", query.category);
  }
  // Um parâmetro só. `assignee=unassigned` vira `unassigned=true` no handler, e
  // qualquer outro valor vira `assigneeId` — os dois juntos seriam 400.
  if (query.assignee) {
    params.set("assignee", query.assignee);
  }
  if (query.search) {
    params.set("search", query.search);
  }

  return params.toString();
}

/**
 * A listagem, em scroll infinito.
 *
 * É o cenário do ponto E do `MAIN.md`: a tela de "todos os chamados" de uma
 * empresa grande. Acumular páginas **exclui** o paginador — oferecer os dois
 * confunde o `meta.total`, que continua sendo o total do servidor e não o
 * tamanho do que já foi carregado.
 */
export function useTickets(query: TicketsQuery) {
  return useInfiniteQuery({
    queryKey: [...helpdeskKeys.tickets, "list", query],
    queryFn: ({ pageParam }) =>
      fetchJson<TicketsPage>(`/api/tickets?${ticketsSearchParams(query, pageParam)}`),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
  });
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: helpdeskKeys.ticket(id),
    queryFn: () => fetchJson<Ticket>(`/api/tickets/${id}`),
  });
}

export interface CreateTicketInput {
  title: string;
  description?: string;
  priority?: TicketPriority;
  category?: TicketCategory;
}

export function useCreateTicket(): UseMutationResult<Ticket, Error, CreateTicketInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTicketInput) =>
      fetchJson<Ticket>("/api/tickets", { method: "POST", ...jsonBody(input) }),
    onSuccess: async (created) => {
      queryClient.setQueryData(helpdeskKeys.ticket(created.id), created);
      await queryClient.invalidateQueries({ queryKey: helpdeskKeys.tickets });
    },
  });
}

export interface UpdateTicketInput {
  title?: string;
  description?: string;
  priority?: TicketPriority;
  category?: TicketCategory;
}

export function useUpdateTicket(
  id: string,
): UseMutationResult<Ticket, Error, UpdateTicketInput> {
  return useVersionedMutation(id, (input: UpdateTicketInput, version) =>
    fetchJson<Ticket>(`/api/tickets/${id}`, {
      method: "PATCH",
      ...jsonBody({ ...input, version }),
    }),
  );
}

export function useChangeStatus(
  id: string,
): UseMutationResult<Ticket, Error, TicketStatus> {
  return useVersionedMutation(id, (status: TicketStatus, version) =>
    fetchJson<Ticket>(`/api/tickets/${id}/status`, {
      method: "PATCH",
      ...jsonBody({ status, version }),
    }),
  );
}

/** `null` desatribui. */
export function useAssign(
  id: string,
): UseMutationResult<Ticket, Error, string | null> {
  return useVersionedMutation(id, (assigneeId: string | null, version) =>
    fetchJson<Ticket>(`/api/tickets/${id}/assignee`, {
      method: "PATCH",
      ...jsonBody({ assigneeId, version }),
    }),
  );
}

/**
 * As três mutações de chamado, com a `version` vindo do cache.
 *
 * **O cache é a fonte da versão, e não um `useState` do formulário.** Um estado
 * paralelo envelheceria em silêncio: depois de um conflito resolvido, a tela
 * reenviaria a versão velha e tomaria outro 409 — que é exatamente o laço que o
 * guia manda não construir.
 *
 * **Sem optimistic update, de propósito.** O ponto da coluna `version` é que o
 * servidor decide quem ganhou; pintar a tela antes da resposta e desfazer
 * depois é a experiência que ela existe para evitar.
 *
 * O sucesso grava o retorno com `setQueryData`: a resposta já traz a versão
 * nova, então isso evita um GET *e* deixa a próxima edição válida.
 */
function useVersionedMutation<TInput>(
  id: string,
  request: (input: TInput, version: number) => Promise<Ticket>,
): UseMutationResult<Ticket, Error, TInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TInput) => request(input, currentVersion(queryClient, id)),
    onSuccess: async (updated) => {
      queryClient.setQueryData(helpdeskKeys.ticket(id), updated);
      await queryClient.invalidateQueries({ queryKey: helpdeskKeys.tickets });
      invalidateTrail(queryClient, id);
    },
  });
}

function currentVersion(queryClient: QueryClient, id: string): number {
  const cached = queryClient.getQueryData<Ticket>(helpdeskKeys.ticket(id));

  if (!cached) {
    // Sem o chamado em cache não há versão que se possa afirmar, e chutar 1
    // produziria um 409 mentiroso — a tela diria "alguém alterou isto" sobre
    // uma requisição que nunca soube o que estava alterando.
    throw new Error("The ticket has not been loaded yet.");
  }

  return cached.version;
}

function invalidateTrail(queryClient: QueryClient, id: string): void {
  setTimeout(() => {
    void queryClient.invalidateQueries({ queryKey: helpdeskKeys.history(id) });
  }, TRAIL_WRITE_DELAY_MS);
}

/** Um comentário novo: a thread muda, o chamado não. */
export interface CommentInput {
  body: string;
  isInternal?: boolean;
}

export function useAddComment(
  ticketId: string,
): UseMutationResult<unknown, Error, CommentInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CommentInput) =>
      fetchJson<unknown>(`/api/tickets/${ticketId}/comments`, {
        method: "POST",
        ...jsonBody(input),
      }),
    onSuccess: async () => {
      // Sem atraso: o comentário aparece pelo próprio texto, que a rota de
      // comentários já devolve. É a entrada da trilha que chega tarde, e ela só
      // acrescenta o autor formal a uma linha que já está na tela.
      await queryClient.invalidateQueries({
        queryKey: helpdeskKeys.history(ticketId),
      });
    },
  });
}

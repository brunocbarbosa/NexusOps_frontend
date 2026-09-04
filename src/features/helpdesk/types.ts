/**
 * Tipos do domínio `helpdesk`, espelhando o contrato medido do backend
 * (`documents/backend/HELPDESK.md`, Part I).
 */

import type { Page } from "@/lib/api/page";
import type { User } from "@/features/identity/types";

export const TICKET_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_CATEGORIES = [
  "HARDWARE",
  "SOFTWARE",
  "NETWORK",
  "ACCESS",
  "OTHER",
] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

/**
 * `TicketResponse` — o que toda rota que devolve um chamado devolve.
 *
 * As três pessoas vêm embutidas em vez de como ids para que a listagem não
 * busque um usuário por linha.
 */
export interface Ticket {
  id: string;
  /** O que uma pessoa fala em voz alta. Recomeça em 1 em cada company. */
  number: number;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  /**
   * Concorrência otimista. Está no fio porque tem de estar: todo `PATCH` a
   * exige de volta, e um cliente não pode devolvê-la sem tê-la recebido.
   */
  version: number;
  requester: User;
  assignee: User | null;
  closedBy: User | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TicketsPage = Page<Ticket>;

/**
 * Os filtros de `GET /tickets`.
 *
 * `assigneeId` e `unassigned` **se contradizem**: mandar os dois é 400. Por
 * isso são um campo só aqui, com `"unassigned"` como valor sentinela — dois
 * campos independentes convidariam a exatamente aquela requisição.
 *
 * `requesterId` não está aqui: para um `REQUESTER` o backend sobrescreve o
 * filtro com o id dele, e a tela do agente ainda não oferece o seletor.
 */
export interface TicketsQuery {
  perPage: number;
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  /** Um id de usuário, `"unassigned"`, ou nada. */
  assignee?: string;
  search?: string;
}

export const UNASSIGNED = "unassigned";

/**
 * `CommentResponse`. A thread é **append-only**: não há `PATCH` nem `DELETE`,
 * porque o que ela alimenta é uma linha do tempo, e uma linha do tempo cujas
 * entradas podem ser reescritas não é uma.
 */
export interface Comment {
  id: string;
  ticketId: string;
  body: string;
  /** O `REQUESTER` nunca recebe um `true` — nem na página, nem no `total`. */
  isInternal: boolean;
  author: User;
  createdAt: string;
}

export const AUDIT_ACTIONS = [
  "created",
  "updated",
  "status_changed",
  "assigned",
  "commented",
  "internal_note_added",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * `AuditResponse`.
 *
 * `oldValues` e `newValues` são JSONB: a forma depende da `action`. Ficam
 * `unknown` de propósito — quem lê um campo específico o faz por um leitor
 * estreito em `format.ts`, e não por uma asserção de tipo espalhada pela tela.
 *
 * `user` é nulo depois de o autor ser anonimizado; a história sobrevive a ele.
 */
export interface AuditEntry {
  id: string;
  entityType: "Ticket";
  entityId: string;
  action: AuditAction;
  oldValues: unknown;
  newValues: unknown;
  user: User | null;
  createdAt: string;
}

/**
 * Uma linha do feed do chamado, já intercalada pelo Route Handler
 * `/api/tickets/:id/history` — ver §3.3 da spec.
 *
 * `comment` traz o texto quando a entrada é `commented` ou
 * `internal_note_added`; `entry` traz a auditoria quando ela já foi escrita. A
 * trilha é gravada **depois** da resposta, então um comentário recém-postado
 * chega com `entry: null` e aparece na hora.
 */
export interface HistoryItem {
  /** `createdAt` da fonte mais antiga — é por ele que a lista é ordenada. */
  createdAt: string;
  entry: AuditEntry | null;
  comment: Comment | null;
}

export interface TicketHistory {
  data: HistoryItem[];
  /**
   * Alguma das duas listas bateu no teto de páginas do handler. A tela avisa,
   * em vez de mostrar um histórico truncado como se fosse completo.
   */
  truncated: boolean;
}

/**
 * Para onde um chamado pode ir a partir de onde está.
 *
 * A ordem é a da tela: primeiro o avanço natural, depois o retorno. `CLOSED` é
 * terminal — não existe rota para apagar um chamado, e fechar é o que toma esse
 * lugar.
 *
 * O backend recusa uma transição fora daqui com 409. Este mapa não é a
 * autoridade: ele evita oferecer um botão que sempre falha.
 */
const TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  OPEN: ["IN_PROGRESS", "RESOLVED"],
  IN_PROGRESS: ["RESOLVED", "OPEN"],
  RESOLVED: ["CLOSED", "OPEN"],
  CLOSED: [],
};

export function nextStatuses(from: TicketStatus): readonly TicketStatus[] {
  return TRANSITIONS[from];
}

export function isTicketStatus(value: unknown): value is TicketStatus {
  return includes(TICKET_STATUSES, value);
}

export function isTicketPriority(value: unknown): value is TicketPriority {
  return includes(TICKET_PRIORITIES, value);
}

export function isTicketCategory(value: unknown): value is TicketCategory {
  return includes(TICKET_CATEGORIES, value);
}

function includes(known: readonly string[], value: unknown): boolean {
  return typeof value === "string" && known.includes(value);
}

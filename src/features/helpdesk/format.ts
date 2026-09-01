/**
 * O vocabulário do backend traduzido para o da tela, e a frase de cada entrada
 * da trilha de auditoria.
 *
 * A frase mora aqui e não no componente porque `ticket.changed`, no socket,
 * carrega o **mesmo** vocabulário de `action` da timeline: a fatia 2 renderiza
 * o evento vivo com este mesmo leitor.
 */

import type {
  AuditEntry,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "./types";

const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  HARDWARE: "Hardware",
  SOFTWARE: "Software",
  NETWORK: "Network",
  ACCESS: "Access",
  OTHER: "Other",
};

const FIELD_LABELS: Record<string, string> = {
  title: "the title",
  description: "the description",
  priority: "the priority",
  category: "the category",
  status: "the status",
};

export function statusLabel(status: TicketStatus): string {
  return STATUS_LABELS[status];
}

export function priorityLabel(priority: TicketPriority): string {
  return PRIORITY_LABELS[priority];
}

export function categoryLabel(category: TicketCategory): string {
  return CATEGORY_LABELS[category];
}

/** Quem um id de usuário é, se a tela souber. `null` quando não souber. */
export type ResolveUser = (id: string) => string | null;

/**
 * A entrada da trilha em uma frase, no sujeito oculto: quem agiu é renderizado
 * separado, então isto começa no verbo — "opened this ticket".
 *
 * `oldValues` e `newValues` são JSONB e a forma depende da `action`. Toda
 * leitura passa por `readString`, que devolve `null` em vez de confiar: um
 * payload fora da forma esperada tem de degradar para uma frase mais curta, não
 * apagar a trilha da tela.
 */
export function describeEntry(entry: AuditEntry, resolveUser: ResolveUser): string {
  switch (entry.action) {
    case "created":
      return "opened this ticket";

    case "commented":
      return "commented";

    case "internal_note_added":
      return "left an internal note";

    case "status_changed": {
      const from = readStatus(entry.oldValues);
      const to = readStatus(entry.newValues);

      return from && to
        ? `moved this from ${statusLabel(from)} to ${statusLabel(to)}`
        : "changed the status";
    }

    case "assigned": {
      const assigneeId = readString(entry.newValues, "assigneeId");

      if (!assigneeId) {
        return "unassigned this ticket";
      }

      const who = resolveUser(assigneeId);

      // Sem o nome, a frase encurta. Mostrar o uuid seria mostrar a chave
      // primária de alguém a quem lê a linha do tempo.
      return who ? `assigned this to ${who}` : "assigned this ticket";
    }

    case "updated": {
      const fields = changedFields(entry.newValues);

      return fields.length > 0
        ? `changed ${joinWithAnd(fields)}`
        : "updated this ticket";
    }
  }
}

/**
 * Os campos que de fato se moveram. `updated` carrega só eles — um `PATCH`
 * parcial que reenvia o mesmo título não reporta mudança de título.
 */
function changedFields(newValues: unknown): string[] {
  if (typeof newValues !== "object" || newValues === null || Array.isArray(newValues)) {
    return [];
  }

  return Object.keys(newValues)
    .map((key) => FIELD_LABELS[key])
    .filter((label): label is string => label !== undefined);
}

function joinWithAnd(parts: string[]): string {
  if (parts.length <= 1) {
    return parts[0] ?? "";
  }

  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function readStatus(values: unknown): TicketStatus | null {
  const status = readString(values, "status");

  return status !== null && status in STATUS_LABELS
    ? (status as TicketStatus)
    : null;
}

function readString(values: unknown, key: string): string | null {
  if (typeof values !== "object" || values === null || Array.isArray(values)) {
    return null;
  }

  const value: unknown = (values as Record<string, unknown>)[key];

  return typeof value === "string" ? value : null;
}

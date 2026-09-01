"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api/errors";

import { useStaff } from "../queries/staff";
import { useAssign, useChangeStatus } from "../queries/tickets";
import { nextStatuses, type Ticket, type TicketStatus } from "../types";

const UNASSIGNED_OPTION = "none";

/**
 * As ações que exigem ADMIN ou AGENT: mover o status e atribuir.
 *
 * O componente inteiro some para um `REQUESTER` — as duas rotas respondem 403
 * para ele. Esconder o que sempre falharia é o padrão das outras telas; a
 * autoridade continua sendo o backend.
 */
export function TicketActions({ ticket }: { ticket: Ticket }) {
  const changeStatus = useChangeStatus(ticket.id);
  const assign = useAssign(ticket.id);
  const staff = useStaff(true);

  const transitions = nextStatuses(ticket.status);

  return (
    <div className="grid gap-4 rounded-lg border p-4">
      <div className="grid gap-2">
        <span className="text-sm font-medium">Status</span>
        {transitions.length === 0 ? (
          // CLOSED é terminal: não existe rota para reabrir, e o fluxo previsto
          // é um chamado novo que faça referência a este.
          <p className="text-muted-foreground text-sm">
            Closed is final. Open a new ticket if it comes back.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {transitions.map((status) => (
              <Button
                key={status}
                variant="outline"
                size="sm"
                disabled={changeStatus.isPending}
                onClick={() => {
                  changeStatus.mutate(status);
                }}
              >
                {actionLabel(ticket.status, status)}
              </Button>
            ))}
          </div>
        )}
        <ActionError error={changeStatus.error} />
      </div>

      <div className="grid gap-2">
        <span className="text-sm font-medium">Assignee</span>
        <Select
          value={ticket.assignee?.id ?? UNASSIGNED_OPTION}
          disabled={assign.isPending}
          onValueChange={(value) => {
            // `null` é o valor que **remove** o responsável, e não a ausência
            // do campo — a rota distingue os dois.
            assign.mutate(value === UNASSIGNED_OPTION ? null : value);
          }}
        >
          <SelectTrigger aria-label="Assignee">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED_OPTION}>Unassigned</SelectItem>
            {/* Só ADMIN e AGENT: atribuir a um REQUESTER é 409, então ele não é
                oferecido. */}
            {(staff.data ?? []).map((person) => (
              <SelectItem key={person.id} value={person.id}>
                {person.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ActionError error={assign.error} />
      </div>
    </div>
  );
}

/**
 * O erro de uma ação, inline e com o texto do backend.
 *
 * O 409 de transição ilegal e o de "um REQUESTER não pode receber chamado"
 * chegam aqui: são 409 e **não** são conflito de versão, então recarregar não
 * ajudaria e abrir o diálogo de conflito mandaria a pessoa reaplicar algo que o
 * servidor vai recusar de novo.
 */
function ActionError({ error }: { error: Error | null }) {
  if (!(error instanceof ApiError)) {
    return null;
  }

  return (
    <p role="alert" className="text-destructive text-sm">
      {error.message}
    </p>
  );
}

/** O verbo, não o destino: "Start work" diz o que o clique faz. */
function actionLabel(from: TicketStatus, to: TicketStatus): string {
  if (to === "OPEN") {
    return "Reopen";
  }
  if (to === "IN_PROGRESS") {
    return "Start work";
  }
  if (to === "RESOLVED") {
    return from === "OPEN" ? "Resolve right away" : "Resolve";
  }

  return "Close";
}

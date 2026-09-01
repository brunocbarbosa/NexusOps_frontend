"use client";

import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/identity/queries/session";
import { ApiError } from "@/lib/api/errors";

import { useTicketHistory } from "../queries/history";
import { useTicket } from "../queries/tickets";
import { CommentComposer } from "./comment-composer";
import { TicketActions } from "./ticket-actions";
import { TicketDetailsCard } from "./ticket-details-card";
import { TicketHeader } from "./ticket-header";
import { TicketHistoryFeed } from "./ticket-history";

/**
 * `/tickets/:id`.
 *
 * O **404 não é um erro de sistema**: é a regra de visibilidade. Um `REQUESTER`
 * só enxerga os chamados que abriu, e a mesma URL responde 200 para um agente e
 * 404 para o colega de sala. A tela diz "não encontrado" e oferece o caminho de
 * volta — um alerta vermelho genérico faria a pessoa abrir um chamado
 * reclamando de um chamado.
 */
export function TicketPage({ ticketId }: { ticketId: string }) {
  const { data: session } = useSession();
  const isStaff = session?.role === "ADMIN" || session?.role === "AGENT";

  const ticket = useTicket(ticketId);
  const history = useTicketHistory(ticketId);

  if (ticket.error instanceof ApiError && ticket.error.status === 404) {
    return (
      <div className="grid gap-4">
        <EmptyState
          title="Ticket not found"
          description="It may have been opened by someone else, or it may not exist. Only the person who opened a ticket and the company's agents can see it."
        />
        <p className="text-center text-sm">
          <Link href="/tickets" className="underline underline-offset-4">
            Back to all tickets
          </Link>
        </p>
      </div>
    );
  }

  if (ticket.isPending) {
    return (
      <div className="grid max-w-4xl gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (ticket.error) {
    return (
      <p
        role="alert"
        className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
      >
        {ticket.error instanceof ApiError
          ? ticket.error.message
          : "Could not load this ticket."}
      </p>
    );
  }

  return (
    <div className="grid max-w-4xl gap-6">
      <TicketHeader ticket={ticket.data} />

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="grid gap-6">
          <TicketDetailsCard ticket={ticket.data} />

          <section className="grid gap-4">
            <h2 className="text-sm font-medium">History</h2>
            <TicketHistoryFeed
              ticket={ticket.data}
              history={history.data}
              isLoading={history.isPending}
            />
          </section>

          <CommentComposer ticket={ticket.data} canWriteInternal={isStaff} />
        </div>

        {/* As duas ações de staff. Some inteiro para um REQUESTER: as rotas
            respondem 403 para ele. */}
        {isStaff ? <TicketActions ticket={ticket.data} /> : null}
      </div>
    </div>
  );
}

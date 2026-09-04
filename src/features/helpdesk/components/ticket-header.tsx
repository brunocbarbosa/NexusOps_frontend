"use client";

import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { formatDate } from "@/features/identity/format";

import type { Ticket } from "../types";
import { CategoryBadge, PriorityBadge, StatusBadge } from "./ticket-badges";

export function TicketHeader({ ticket }: { ticket: Ticket }) {
  return (
    <header className="grid gap-3">
      <Link
        href="/tickets"
        className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm"
      >
        <ArrowLeftIcon className="size-4" aria-hidden />
        All tickets
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        {/* O número, e não o id: é o que uma pessoa fala em voz alta. Ele
            recomeça em 1 em cada company, então não endereça nada — quem
            endereça é o uuid da URL. */}
        <span className="text-muted-foreground text-xl font-medium tabular-nums">
          #{ticket.number}
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">{ticket.title}</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={ticket.status} />
        <PriorityBadge priority={ticket.priority} />
        <CategoryBadge category={ticket.category} />
        <span className="text-muted-foreground text-sm">
          Opened by {ticket.requester.email} on {formatDate(ticket.createdAt)}
        </span>
      </div>
    </header>
  );
}

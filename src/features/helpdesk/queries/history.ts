"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchJson } from "@/lib/api/client";

import type { TicketHistory } from "../types";
import { helpdeskKeys } from "./keys";

/**
 * A linha do tempo do chamado, já intercalada pelo Route Handler.
 *
 * Uma query só, porque o servidor já juntou `/timeline` com `/comments` — ver
 * `features/helpdesk/history.ts` e a §3.3 da spec.
 */
export function useTicketHistory(ticketId: string) {
  return useQuery({
    queryKey: helpdeskKeys.history(ticketId),
    queryFn: () => fetchJson<TicketHistory>(`/api/tickets/${ticketId}/history`),
  });
}

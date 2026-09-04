"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/identity/queries/session";
import { ApiError } from "@/lib/api/errors";

import { useTickets } from "../queries/tickets";
import type { TicketsQuery } from "../types";
import { NewTicketDialog } from "./new-ticket-dialog";
import { TicketsList } from "./tickets-list";
import { TicketsToolbar } from "./tickets-toolbar";

const PER_PAGE = 50;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * `/tickets` — a lista.
 *
 * Não há guarda de papel aqui, e isso é o desenho: os três papéis de company
 * têm chamados. O que muda entre eles vem do backend — um `REQUESTER` recebe
 * só os que abriu, e o `meta.total` já conta apenas esses.
 *
 * O operador da plataforma não chega nesta tela: ele não pertence a company
 * nenhuma e não tem chamados. O menu não lhe mostra o item.
 */
export function TicketsPage() {
  const { data: session } = useSession();
  const isStaff = session?.role === "ADMIN" || session?.role === "AGENT";

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState<TicketsQuery>({ perPage: PER_PAGE });

  // Uma requisição por tecla digitada seria uma por letra do título procurado.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery((current) =>
        current.search === (search || undefined)
          ? current
          : { ...current, search: search || undefined },
      );
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [search]);

  const tickets = useTickets(query);
  const [creating, setCreating] = useState(false);

  const onFilterChange = useCallback((changes: Partial<TicketsQuery>) => {
    // Não há página a reiniciar: mudar o filtro muda a chave de cache, e a
    // query infinita recomeça da primeira página sozinha.
    setQuery((current) => ({ ...current, ...changes }));
  }, []);

  const rows = useMemo(
    () => tickets.data?.pages.flatMap((page) => page.data),
    [tickets.data],
  );

  const onLoadMore = useCallback(() => {
    void tickets.fetchNextPage();
  }, [tickets]);

  // `meta.total` respeita visibilidade: o de um requester conta só os dele.
  const total = tickets.data?.pages[0]?.meta.total;

  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Tickets</h1>
        <p className="text-muted-foreground text-sm">
          {isStaff
            ? "Every ticket in your company, newest first."
            : "The tickets you opened, newest first."}
        </p>
      </header>

      <TicketsToolbar
        search={search}
        onSearchChange={setSearch}
        query={query}
        onFilterChange={onFilterChange}
        canFilterByAssignee={isStaff}
        onCreate={() => {
          setCreating(true);
        }}
      />

      {tickets.error ? (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {tickets.error instanceof ApiError
            ? tickets.error.message
            : "Could not load tickets."}
        </p>
      ) : null}

      {tickets.isPending ? (
        <ListSkeleton />
      ) : (
        <TicketsList
          tickets={rows}
          isLoading={tickets.isFetching}
          hasNextPage={tickets.hasNextPage}
          isFetchingNextPage={tickets.isFetchingNextPage}
          onLoadMore={onLoadMore}
        />
      )}

      {/* O total é o do servidor, não o do que já foi carregado — e é por isso
          que não há paginador ao lado dele. */}
      <p className="text-muted-foreground text-sm">
        {total === undefined
          ? null
          : `${String(total)} ticket${total === 1 ? "" : "s"}`}
      </p>

      <NewTicketDialog
        open={creating}
        onClose={() => {
          setCreating(false);
        }}
      />
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="grid gap-2 rounded-lg border p-4">
      {[0, 1, 2, 3, 4].map((row) => (
        <Skeleton key={row} className="h-10 w-full" />
      ))}
    </div>
  );
}

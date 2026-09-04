"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

import { formatDate } from "@/features/identity/format";
import { cn } from "@/lib/utils";

import type { Ticket } from "../types";
import { CategoryBadge, PriorityBadge, StatusBadge } from "./ticket-badges";

/**
 * A listagem de chamados — virtualizada, e a única do produto que precisa ser.
 *
 * É o cenário do ponto E do `MAIN.md`: a tela de "todos os chamados" de uma
 * empresa grande. A tabela de usuários **não** é virtualizada porque `perPage`
 * para em 100 lá e 100 linhas não quebram o DOM; aqui as páginas se acumulam.
 *
 * **Acumular páginas exclui o paginador.** Oferecer os dois confunde o
 * `meta.total`, que continua sendo o total do servidor e não o tamanho do que
 * já foi carregado.
 *
 * **Não há cabeçalho clicável para ordenar.** A ordenação não é configurável
 * pelo cliente — a lista vem sempre do mais novo para o mais antigo e não
 * existe parâmetro para isso. Um cabeçalho ordenável ordenaria apenas o que já
 * foi carregado, e mentiria para quem olha.
 *
 * O TanStack Table entra **headless**, só pelo modelo de colunas: as linhas são
 * `div`s em grid porque uma linha posicionada em absoluto dentro de um
 * `<tbody>` não se comporta como linha de tabela. Daí os papéis ARIA
 * explícitos.
 */

const ROW_HEIGHT = 56;
const COLUMNS = "5rem minmax(16rem,1fr) 8rem 7rem 12rem 7rem";

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, Ticket>();
const NO_ROWS: Ticket[] = [];

export function TicketsList({
  tickets,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: {
  tickets: Ticket[] | undefined;
  isLoading: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}) {
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("number", {
          header: "#",
          cell: (info) => (
            <span className="text-muted-foreground tabular-nums">
              {info.getValue()}
            </span>
          ),
        }),
        helper.accessor("title", {
          header: "Title",
          cell: (info) => (
            <div className="flex min-w-0 items-center gap-2">
              {/* O link cobre a linha inteira (`after:inset-0`), então clicar em
                  qualquer lugar navega — e ainda existe um só alvo focável por
                  linha, em vez de seis. */}
              <Link
                href={`/tickets/${info.row.original.id}`}
                className="truncate font-medium after:absolute after:inset-0 focus-visible:outline-none"
              >
                {info.getValue()}
              </Link>
              <CategoryBadge category={info.row.original.category} />
            </div>
          ),
        }),
        helper.accessor("status", {
          header: "Status",
          cell: (info) => <StatusBadge status={info.getValue()} />,
        }),
        helper.accessor("priority", {
          header: "Priority",
          cell: (info) => <PriorityBadge priority={info.getValue()} />,
        }),
        helper.accessor("assignee", {
          header: "Assignee",
          cell: (info) => {
            const assignee = info.getValue();

            return (
              <span
                className={cn(
                  "truncate text-sm",
                  assignee ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {assignee ? assignee.email : "Unassigned"}
              </span>
            );
          },
        }),
        helper.accessor("createdAt", {
          header: "Opened",
          cell: (info) => (
            <span className="text-muted-foreground text-sm tabular-nums">
              {formatDate(info.getValue())}
            </span>
          ),
        }),
      ]),
    [],
  );

  const table = useTable({ features, columns, data: tickets ?? NO_ROWS });
  const rows = table.getRowModel().rows;

  // O React Compiler avisa que não consegue memoizar este componente por causa
  // do `useVirtualizer` ("returns functions that cannot be memoized safely"). É
  // esperado e não é um defeito a corrigir: uma lista virtualizada re-renderiza
  // a cada scroll por definição, que é justamente o que memoizar impediria.
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const lastIndex = virtualRows.at(-1)?.index;

  useEffect(() => {
    // O gatilho é a última linha **renderizada** alcançar o fim das carregadas.
    // Um sentinela no fim do DOM não serviria: com virtualização ele não está
    // no DOM até o scroll chegar perto, que é justamente quando já é tarde.
    if (
      lastIndex !== undefined &&
      lastIndex >= rows.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      onLoadMore();
    }
  }, [lastIndex, rows.length, hasNextPage, isFetchingNextPage, onLoadMore]);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border">
        <ListHeader table={table} />
        <p className="text-muted-foreground py-12 text-center text-sm">
          {isLoading ? "Loading tickets…" : "No tickets match these filters."}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border" role="grid">
      <ListHeader table={table} />

      <div ref={scrollRef} className="max-h-[60vh] overflow-auto">
        <div
          className="relative w-full"
          style={{ height: `${String(virtualizer.getTotalSize())}px` }}
        >
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];

            return (
              <div
                key={row.id}
                role="row"
                className="hover:bg-muted/50 absolute top-0 left-0 grid w-full items-center gap-3 border-b px-4 transition-colors"
                style={{
                  gridTemplateColumns: COLUMNS,
                  height: `${String(virtualRow.size)}px`,
                  transform: `translateY(${String(virtualRow.start)}px)`,
                }}
              >
                {row.getAllCells().map((cell) => (
                  <div key={cell.id} role="gridcell" className="min-w-0">
                    <table.FlexRender cell={cell} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {isFetchingNextPage ? (
        <p className="text-muted-foreground border-t py-3 text-center text-sm">
          Loading more…
        </p>
      ) : null}
    </div>
  );
}

function ListHeader({ table }: { table: ReturnType<typeof useTable<typeof features, Ticket>> }) {
  return (
    <div className="bg-muted/40 border-b" role="rowgroup">
      {table.getHeaderGroups().map((group) => (
        <div
          key={group.id}
          role="row"
          className="text-muted-foreground grid gap-3 px-4 py-2 text-xs font-medium"
          style={{ gridTemplateColumns: COLUMNS }}
        >
          {group.headers.map((header) => (
            <div key={header.id} role="columnheader" className="min-w-0">
              {header.isPlaceholder ? null : <table.FlexRender header={header} />}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

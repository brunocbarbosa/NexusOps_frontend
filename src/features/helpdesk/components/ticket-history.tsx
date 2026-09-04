"use client";

import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { User } from "@/features/identity/types";

import { describeEntry, type ResolveUser } from "../format";
import type { HistoryItem, Ticket, TicketHistory } from "../types";

/**
 * O feed do chamado: a trilha de auditoria e a thread de comentários já
 * intercaladas pelo Route Handler.
 *
 * **Não é virtualizado**, e isso é escolha. O feed de um chamado é curto — o
 * teto do handler é 2000 entradas, e um chamado real tem dezenas. Quem precisa
 * de virtualização é a listagem de chamados, e depois o feed `/audit` da
 * empresa inteira, que é da fatia 2.
 *
 * Nada é filtrado aqui. Um `REQUESTER` não recebe `internal_note_added` nem o
 * comentário correspondente em nenhuma das duas rotas; refiltrar seria manter
 * uma segunda cópia da regra de visibilidade.
 */
export function TicketHistoryFeed({
  ticket,
  history,
  isLoading,
}: {
  ticket: Ticket;
  history: TicketHistory | undefined;
  isLoading: boolean;
}) {
  const resolveUser = useMemo(
    () => buildResolver(ticket, history?.data ?? []),
    [ticket, history],
  );

  if (isLoading) {
    return (
      <div className="grid gap-3">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const items = history?.data ?? [];

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Nothing has happened yet.</p>
    );
  }

  return (
    <div className="grid gap-4">
      {history?.truncated ? (
        <p className="text-muted-foreground text-sm">
          Only the most recent part of this history is shown.
        </p>
      ) : null}

      <ol className="grid gap-4">
        {items.map((item) => (
          <li key={keyOf(item)}>
            <HistoryRow item={item} resolveUser={resolveUser} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function HistoryRow({
  item,
  resolveUser,
}: {
  item: HistoryItem;
  resolveUser: ResolveUser;
}) {
  const who = item.comment?.author.email ?? item.entry?.user?.email;
  const when = new Date(item.createdAt).toLocaleString();

  if (item.comment) {
    return (
      <article className="grid gap-1.5 rounded-lg border p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{who ?? "A removed user"}</span>
          {item.comment.isInternal ? (
            <Badge
              variant="outline"
              className="border-amber-500/40 text-amber-700 dark:text-amber-300"
            >
              Internal note
            </Badge>
          ) : null}
          <time className="text-muted-foreground text-xs" dateTime={item.createdAt}>
            {when}
          </time>
        </div>
        <p className="text-sm whitespace-pre-wrap">{item.comment.body}</p>
      </article>
    );
  }

  return (
    <p className="text-muted-foreground px-3 text-sm">
      {/* `user` é nulo depois de o autor ser anonimizado: a história sobrevive
          a quem a escreveu, e a linha não pode sumir por causa disso. */}
      <span className="text-foreground font-medium">{who ?? "A removed user"}</span>{" "}
      {item.entry ? describeEntry(item.entry, resolveUser) : "did something"}{" "}
      <time className="text-xs" dateTime={item.createdAt}>
        · {when}
      </time>
    </p>
  );
}

function keyOf(item: HistoryItem): string {
  return item.entry?.id ?? item.comment?.id ?? item.createdAt;
}

/**
 * Quem é cada id que aparece dentro de um `newValues`.
 *
 * Montado a partir de quem já veio na resposta — as três pessoas do chamado, os
 * autores dos comentários e os atores das entradas. Nenhuma requisição extra: o
 * `assigneeId` de uma atribuição quase sempre é alguém que aparece em outro
 * lugar do próprio feed, e quando não é a frase encurta em vez de exibir um
 * uuid a quem lê.
 */
function buildResolver(ticket: Ticket, items: readonly HistoryItem[]): ResolveUser {
  const byId = new Map<string, string>();

  const remember = (user: User | null) => {
    if (user) {
      byId.set(user.id, user.email);
    }
  };

  remember(ticket.requester);
  remember(ticket.assignee);
  remember(ticket.closedBy);

  for (const item of items) {
    remember(item.entry?.user ?? null);
    remember(item.comment?.author ?? null);
  }

  return (id) => byId.get(id) ?? null;
}

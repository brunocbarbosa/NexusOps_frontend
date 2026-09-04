/**
 * A junção das duas rotas que formam a linha do tempo de um chamado.
 *
 * `GET /tickets/:id/timeline` traz as **mudanças**; `GET /tickets/:id/comments`
 * traz os **textos**. O backend não os junta de propósito — o corpo de um
 * comentário não pertence à trilha de auditoria —, e a ligação entre as duas
 * listas é `newValues.commentId` nas entradas `commented` e
 * `internal_note_added`.
 *
 * A função é pura e roda no servidor, dentro de `/api/tickets/:id/history`.
 * Fazer a intercalação no browser exigiria duas `useInfiniteQuery` paginadas
 * avançando em passo, porque ordenar globalmente por `createdAt` pede as duas
 * listas inteiras.
 *
 * Nada é filtrado aqui. Um `REQUESTER` nunca recebe `internal_note_added` nem o
 * comentário correspondente — em nenhuma das duas rotas, nem no `total`. Uma
 * segunda filtragem seria uma segunda cópia da regra de visibilidade, e a cópia
 * é o que sai do ar com o tempo.
 */

import type { AuditEntry, Comment, HistoryItem } from "./types";

/** As duas ações cujo assunto é um comentário. */
const COMMENT_ACTIONS: readonly string[] = ["commented", "internal_note_added"];

export function mergeHistory(
  entries: readonly AuditEntry[],
  comments: readonly Comment[],
): HistoryItem[] {
  const byCommentId = new Map(comments.map((comment) => [comment.id, comment]));
  const claimed = new Set<string>();

  const fromEntries = entries.map((entry): HistoryItem => {
    const comment = commentOf(entry, byCommentId);

    if (!comment) {
      return { createdAt: entry.createdAt, entry, comment: null };
    }

    claimed.add(comment.id);

    // Datado pelo **comentário**, não pela entrada: a trilha é escrita depois
    // da resposta, então a entrada é sempre um instante mais nova, e datar por
    // ela empurraria a fala para depois do que aconteceu no meio.
    return { createdAt: comment.createdAt, entry, comment };
  });

  // Um comentário sem entrada aparece assim mesmo — é o caso de quem acabou de
  // escrever e ainda não viu a trilha alcançá-lo.
  const orphanComments = comments
    .filter((comment) => !claimed.has(comment.id))
    .map((comment): HistoryItem => ({
      createdAt: comment.createdAt,
      entry: null,
      comment,
    }));

  return [...fromEntries, ...orphanComments].sort(byTimeThenId);
}

function commentOf(
  entry: AuditEntry,
  byCommentId: ReadonlyMap<string, Comment>,
): Comment | null {
  if (!COMMENT_ACTIONS.includes(entry.action)) {
    return null;
  }

  const commentId = readCommentId(entry.newValues);

  return commentId ? (byCommentId.get(commentId) ?? null) : null;
}

function readCommentId(newValues: unknown): string | null {
  if (
    typeof newValues !== "object" ||
    newValues === null ||
    Array.isArray(newValues)
  ) {
    return null;
  }

  const value: unknown = (newValues as Record<string, unknown>).commentId;

  return typeof value === "string" ? value : null;
}

/**
 * Do mais antigo para o mais novo — uma thread se lê de cima para baixo, ao
 * contrário da lista de chamados.
 *
 * O desempate por id não é preciosismo: a criação do chamado e a primeira
 * entrada da trilha saem no mesmo instante, e uma ordenação instável faria a
 * lista trocar de forma entre dois renders com exatamente os mesmos dados.
 */
function byTimeThenId(a: HistoryItem, b: HistoryItem): number {
  if (a.createdAt !== b.createdAt) {
    return a.createdAt < b.createdAt ? -1 : 1;
  }

  return idOf(a).localeCompare(idOf(b));
}

function idOf(item: HistoryItem): string {
  return item.entry?.id ?? item.comment?.id ?? "";
}

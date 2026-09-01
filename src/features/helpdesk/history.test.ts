import { mergeHistory } from "./history";
import type { AuditEntry, Comment } from "./types";

const author = {
  id: "u1",
  email: "req@acme.com",
  role: "REQUESTER" as const,
  createdAt: "2026-08-01T00:00:00.000Z",
  deletedAt: null,
};

function comment(patch: Partial<Comment>): Comment {
  return {
    id: "c1",
    ticketId: "t1",
    body: "Still jamming this morning.",
    isInternal: false,
    author,
    createdAt: "2026-09-01T10:00:00.000Z",
    ...patch,
  };
}

function entry(patch: Partial<AuditEntry>): AuditEntry {
  return {
    id: "a1",
    entityType: "Ticket",
    entityId: "t1",
    action: "created",
    oldValues: {},
    newValues: {},
    user: author,
    createdAt: "2026-09-01T09:00:00.000Z",
    ...patch,
  };
}

describe("mergeHistory", () => {
  it("ordena as duas listas por createdAt, do mais antigo para o mais novo", () => {
    // A thread se lê de cima para baixo, ao contrário da lista de chamados.
    const merged = mergeHistory(
      [
        entry({ id: "a1", createdAt: "2026-09-01T09:00:00.000Z" }),
        entry({ id: "a2", action: "status_changed", createdAt: "2026-09-01T11:00:00.000Z" }),
      ],
      [comment({ id: "c1", createdAt: "2026-09-01T10:00:00.000Z" })],
    );

    expect(merged.map((item) => item.createdAt)).toEqual([
      "2026-09-01T09:00:00.000Z",
      "2026-09-01T10:00:00.000Z",
      "2026-09-01T11:00:00.000Z",
    ]);
  });

  it("junta o comentário e a entrada que o anuncia numa linha só", () => {
    // A entrada `commented` carrega `newValues.commentId`: é a ligação entre as
    // duas rotas, e o backend as mantém separadas de propósito — o corpo do
    // comentário não pertence à trilha de auditoria.
    const merged = mergeHistory(
      [
        entry({
          id: "a2",
          action: "commented",
          newValues: { commentId: "c1" },
          createdAt: "2026-09-01T10:00:01.000Z",
        }),
      ],
      [comment({ id: "c1", createdAt: "2026-09-01T10:00:00.000Z" })],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].comment?.id).toBe("c1");
    expect(merged[0].entry?.action).toBe("commented");
  });

  it("data a linha juntada pelo comentário, não pela entrada da trilha", () => {
    // A trilha é escrita **depois** da resposta, então a entrada é sempre um
    // instante mais nova. Datar por ela empurraria o comentário para depois de
    // algo que aconteceu no meio.
    const merged = mergeHistory(
      [
        entry({
          action: "commented",
          newValues: { commentId: "c1" },
          createdAt: "2026-09-01T10:00:05.000Z",
        }),
      ],
      [comment({ id: "c1", createdAt: "2026-09-01T10:00:00.000Z" })],
    );

    expect(merged[0].createdAt).toBe("2026-09-01T10:00:00.000Z");
  });

  it("mostra um comentário cuja entrada de auditoria ainda não chegou", () => {
    // O caso que motiva o merge acontecer aqui: um GET logo depois de um POST
    // pode vir uma entrada atrás. O texto é a fonte, então ele aparece na hora.
    const merged = mergeHistory([], [comment({ id: "c1" })]);

    expect(merged).toHaveLength(1);
    expect(merged[0].comment?.body).toBe("Still jamming this morning.");
    expect(merged[0].entry).toBeNull();
  });

  it("mostra a entrada cujo comentário não veio, sem inventar corpo", () => {
    // Pode acontecer quando a lista de comentários bate no teto de páginas.
    // Sumir com a linha esconderia que alguém falou.
    const merged = mergeHistory(
      [entry({ action: "commented", newValues: { commentId: "c9" } })],
      [],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].comment).toBeNull();
    expect(merged[0].entry?.action).toBe("commented");
  });

  it("junta também a nota interna", () => {
    const merged = mergeHistory(
      [
        entry({
          action: "internal_note_added",
          newValues: { commentId: "c1" },
          createdAt: "2026-09-01T10:00:01.000Z",
        }),
      ],
      [comment({ id: "c1", isInternal: true })],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].comment?.isInternal).toBe(true);
  });

  it("não junta uma entrada que não é de comentário, mesmo com commentId no payload", () => {
    const merged = mergeHistory(
      [entry({ action: "updated", newValues: { commentId: "c1", title: "x" } })],
      [comment({ id: "c1" })],
    );

    expect(merged).toHaveLength(2);
  });

  it("não engole nada quando o JSONB não tem a forma esperada", () => {
    for (const newValues of [null, "texto", 42, [], { commentId: 7 }]) {
      const merged = mergeHistory(
        [entry({ action: "commented", newValues })],
        [comment({ id: "c1" })],
      );

      expect(merged).toHaveLength(2);
    }
  });

  it("desempata por id para que a ordem não dependa da sorte", () => {
    // Duas mutações no mesmo milissegundo existem: a criação e a primeira
    // entrada da trilha saem juntas. Uma ordenação instável faria a lista
    // trocar de forma entre dois renders com os mesmos dados.
    const first = mergeHistory(
      [
        entry({ id: "a2", createdAt: "2026-09-01T09:00:00.000Z" }),
        entry({ id: "a1", createdAt: "2026-09-01T09:00:00.000Z" }),
      ],
      [],
    );
    const second = mergeHistory(
      [
        entry({ id: "a1", createdAt: "2026-09-01T09:00:00.000Z" }),
        entry({ id: "a2", createdAt: "2026-09-01T09:00:00.000Z" }),
      ],
      [],
    );

    expect(first.map((item) => item.entry?.id)).toEqual(["a1", "a2"]);
    expect(second.map((item) => item.entry?.id)).toEqual(["a1", "a2"]);
  });

  it("devolve lista vazia para um chamado sem nada", () => {
    expect(mergeHistory([], [])).toEqual([]);
  });
});

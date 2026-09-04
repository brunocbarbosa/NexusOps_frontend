import type { AuditEntry } from "./types";
import {
  categoryLabel,
  describeEntry,
  priorityLabel,
  statusLabel,
} from "./format";

function entry(patch: Partial<AuditEntry>): AuditEntry {
  return {
    id: "a1",
    entityType: "Ticket",
    entityId: "t1",
    action: "created",
    oldValues: {},
    newValues: {},
    user: null,
    createdAt: "2026-09-01T10:00:00.000Z",
    ...patch,
  };
}

describe("rótulos", () => {
  it("traduz o vocabulário do backend para o da tela", () => {
    expect(statusLabel("IN_PROGRESS")).toBe("In progress");
    expect(priorityLabel("URGENT")).toBe("Urgent");
    expect(categoryLabel("HARDWARE")).toBe("Hardware");
  });
});

describe("describeEntry", () => {
  const noone = () => null;

  it("descreve a abertura", () => {
    expect(describeEntry(entry({ action: "created" }), noone)).toBe(
      "opened this ticket",
    );
  });

  it("nomeia os campos que mudaram, e só eles", () => {
    // `updated` carrega apenas o que de fato se moveu: um PATCH que reenvia o
    // mesmo título não reporta mudança de título.
    const described = describeEntry(
      entry({
        action: "updated",
        oldValues: { title: "Old", priority: "LOW" },
        newValues: { title: "New", priority: "HIGH" },
      }),
      noone,
    );

    expect(described).toBe("changed the title and the priority");
  });

  it("descreve a mudança de status com os dois lados", () => {
    expect(
      describeEntry(
        entry({
          action: "status_changed",
          oldValues: { status: "OPEN" },
          newValues: { status: "IN_PROGRESS" },
        }),
        noone,
      ),
    ).toBe("moved this from Open to In progress");
  });

  it("nomeia quem recebeu o chamado quando o id é conhecido", () => {
    const described = describeEntry(
      entry({
        action: "assigned",
        oldValues: { assigneeId: null },
        newValues: { assigneeId: "u9" },
      }),
      (id) => (id === "u9" ? "agent@acme.com" : null),
    );

    expect(described).toBe("assigned this to agent@acme.com");
  });

  it("não inventa um nome para um id que não conhece", () => {
    // Uma entrada antiga pode apontar para alguém que já não está na lista de
    // staff. Dizer "assigned this to u9" mostraria um uuid a quem lê.
    expect(
      describeEntry(
        entry({ action: "assigned", newValues: { assigneeId: "u9" } }),
        noone,
      ),
    ).toBe("assigned this ticket");
  });

  it("descreve a remoção do responsável", () => {
    expect(
      describeEntry(
        entry({
          action: "assigned",
          oldValues: { assigneeId: "u9" },
          newValues: { assigneeId: null },
        }),
        noone,
      ),
    ).toBe("unassigned this ticket");
  });

  it("distingue comentário de nota interna", () => {
    expect(describeEntry(entry({ action: "commented" }), noone)).toBe("commented");
    expect(describeEntry(entry({ action: "internal_note_added" }), noone)).toBe(
      "left an internal note",
    );
  });

  it("não quebra quando o JSONB não tem a forma esperada", () => {
    // `oldValues` e `newValues` são JSONB e a forma depende da ação. Uma leitura
    // que assumisse a forma transformaria um payload inesperado numa tela
    // branca — e é a trilha de auditoria, a última coisa que deve sumir.
    for (const values of [null, "texto", 42, [], { status: 9 }]) {
      expect(
        describeEntry(
          entry({ action: "status_changed", oldValues: values, newValues: values }),
          noone,
        ),
      ).toBe("changed the status");
    }
  });
});

import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  isTicketStatus,
  isTicketPriority,
  isTicketCategory,
  nextStatuses,
} from "./types";

describe("enums do ticket", () => {
  it("carrega os quatro status, as quatro prioridades e as cinco categorias", () => {
    expect(TICKET_STATUSES).toEqual([
      "OPEN",
      "IN_PROGRESS",
      "RESOLVED",
      "CLOSED",
    ]);
    expect(TICKET_PRIORITIES).toEqual(["LOW", "MEDIUM", "HIGH", "URGENT"]);
    expect(TICKET_CATEGORIES).toEqual([
      "HARDWARE",
      "SOFTWARE",
      "NETWORK",
      "ACCESS",
      "OTHER",
    ]);
  });

  it("recusa qualquer coisa que não seja um valor do contrato", () => {
    for (const value of ["", "open", "Aberto", null, undefined, 1, {}]) {
      expect(isTicketStatus(value)).toBe(false);
      expect(isTicketPriority(value)).toBe(false);
      expect(isTicketCategory(value)).toBe(false);
    }
  });

  it("aceita os valores do contrato", () => {
    expect(TICKET_STATUSES.every(isTicketStatus)).toBe(true);
    expect(TICKET_PRIORITIES.every(isTicketPriority)).toBe(true);
    expect(TICKET_CATEGORIES.every(isTicketCategory)).toBe(true);
  });
});

describe("nextStatuses", () => {
  // O ciclo de vida do `documents/backend/HELPDESK.md`:
  //
  //   OPEN ──► IN_PROGRESS ──► RESOLVED ──► CLOSED
  //     ▲            │             │
  //     └────────────┴─────────────┘  (reabrir)
  //
  // OPEN também vai direto para RESOLVED, para o chamado que se resolve
  // sozinho. CLOSED é terminal.

  it("deixa um chamado aberto ir para em andamento ou direto para resolvido", () => {
    expect(nextStatuses("OPEN")).toEqual(["IN_PROGRESS", "RESOLVED"]);
  });

  it("deixa um chamado em andamento resolver ou voltar para aberto", () => {
    expect(nextStatuses("IN_PROGRESS")).toEqual(["RESOLVED", "OPEN"]);
  });

  it("deixa um resolvido fechar ou reabrir, mas não voltar para em andamento", () => {
    // O backend recusa esta exata transição com 409:
    // "A ticket cannot go from RESOLVED to IN_PROGRESS".
    expect(nextStatuses("RESOLVED")).toEqual(["CLOSED", "OPEN"]);
    expect(nextStatuses("RESOLVED")).not.toContain("IN_PROGRESS");
  });

  it("não oferece saída de um chamado fechado", () => {
    // CLOSED é terminal e toma o lugar que um DELETE teria: não existe rota
    // para apagar um chamado, porque ele é o assunto de uma trilha de
    // auditoria. Um controle de status ali seria um botão que sempre falha.
    expect(nextStatuses("CLOSED")).toEqual([]);
  });

  it("nunca oferece o status em que o chamado já está", () => {
    for (const status of TICKET_STATUSES) {
      expect(nextStatuses(status)).not.toContain(status);
    }
  });
});

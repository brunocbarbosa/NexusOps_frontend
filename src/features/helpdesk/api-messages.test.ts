import { parseVersionConflict } from "./api-messages";

describe("parseVersionConflict", () => {
  it("extrai a versão atual do 409 de concorrência", () => {
    // Capturado do backend em `documents/backend/HELPDESK.md`. A versão vem na
    // mensagem justamente para a tela poder dizer o quanto se estava atrasado.
    const message =
      "This ticket was changed by someone else (it is now at version 4). Reload it and reapply your change.";

    expect(parseVersionConflict(message)).toBe(4);
  });

  it("lê uma versão de mais de um dígito", () => {
    expect(
      parseVersionConflict(
        "This ticket was changed by someone else (it is now at version 137). Reload it and reapply your change.",
      ),
    ).toBe(137);
  });

  it("devolve null para o 409 de transição ilegal", () => {
    // É 409 e não é conflito de versão: recarregar não ajudaria, e abrir o
    // diálogo de conflito diria à pessoa para reaplicar algo que o servidor
    // vai recusar de novo.
    expect(
      parseVersionConflict("A ticket cannot go from RESOLVED to IN_PROGRESS"),
    ).toBeNull();
  });

  it("devolve null para o 409 de assignee inválido", () => {
    expect(
      parseVersionConflict(
        "req@capture.example is a REQUESTER and cannot be assigned a ticket. Only an AGENT or an ADMIN works tickets.",
      ),
    ).toBeNull();
  });

  it("devolve null para qualquer outra mensagem", () => {
    for (const message of ["", "Conflict", "it is now at version"]) {
      expect(parseVersionConflict(message)).toBeNull();
    }
  });
});

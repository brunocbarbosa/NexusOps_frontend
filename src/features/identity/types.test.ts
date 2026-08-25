import { ASSIGNABLE_ROLES, ROLES, isAssignableRole } from "./types";

describe("papéis", () => {
  it("não deixa ADMIN_MASTER ser atribuível", () => {
    // Fronteira de segurança, não formalidade: o papel pertence à plataforma,
    // e nenhuma rota da API o aceita — pedir por ele é 400. Se alguém juntar
    // as duas listas, este teste é quem avisa.
    expect(isAssignableRole("ADMIN_MASTER")).toBe(false);
    expect(ASSIGNABLE_ROLES).not.toContain("ADMIN_MASTER");
  });

  it("aceita os três papéis de company", () => {
    expect(ASSIGNABLE_ROLES.every(isAssignableRole)).toBe(true);
  });

  it("recusa qualquer coisa que não seja um papel conhecido", () => {
    for (const value of ["", "admin", "OWNER", null, undefined, 1, {}]) {
      expect(isAssignableRole(value)).toBe(false);
    }
  });

  it("exibe os quatro papéis, atribuíveis ou não", () => {
    expect(ROLES).toEqual(["ADMIN_MASTER", "ADMIN", "AGENT", "REQUESTER"]);
  });
});

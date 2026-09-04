import { landingPath, safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it("aceita caminho interno", () => {
    expect(safeNextPath("/users?page=2")).toBe("/users?page=2");
  });

  it.each([
    "https://exemplo.invalido",
    "//exemplo.invalido",
    "javascript:alert(1)",
    "",
    null,
    undefined,
  ])("recusa %p e cai para a raiz, que despacha por papel", (value) => {
    expect(safeNextPath(value)).toBe("/");
  });
});

describe("landingPath", () => {
  it("manda o operador para o console dele", () => {
    expect(landingPath("ADMIN_MASTER", null)).toBe("/platform/companies");
  });

  it.each(["ADMIN", "AGENT", "REQUESTER"] as const)(
    "manda %s para os chamados, que é a casa dos três",
    (role) => {
      // `/users` exigiria ADMIN ou AGENT: um REQUESTER mandado para lá caía num
      // 403 na primeira tela que via.
      expect(landingPath(role, null)).toBe("/tickets");
    },
  );

  it("respeita o destino guardado quando ele é do console de quem entrou", () => {
    expect(landingPath("ADMIN", "/account")).toBe("/account");
    expect(landingPath("ADMIN_MASTER", "/platform/companies/c1/users")).toBe(
      "/platform/companies/c1/users",
    );
  });

  it("ignora um destino do outro console em vez de entregar um 403", () => {
    // `/platform/companies` protegido manda para `/login?next=/platform/companies`.
    // O porteiro não sabia quem viria entrar; quem sabe é isto aqui.
    expect(landingPath("ADMIN", "/platform/companies")).toBe("/tickets");
    expect(landingPath("ADMIN_MASTER", "/users")).toBe("/platform/companies");
  });

  it("não confunde um caminho que só começa parecido", () => {
    expect(landingPath("ADMIN", "/platformer")).toBe("/platformer");
  });

  it("recusa destino externo antes de olhar o papel", () => {
    expect(landingPath("ADMIN", "//exemplo.invalido")).toBe("/tickets");
    expect(landingPath("ADMIN_MASTER", "https://exemplo.invalido")).toBe(
      "/platform/companies",
    );
  });
});

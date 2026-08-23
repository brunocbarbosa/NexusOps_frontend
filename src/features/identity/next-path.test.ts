import { safeNextPath } from "./next-path";

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
  ])("recusa %p e cai para /users", (value) => {
    expect(safeNextPath(value)).toBe("/users");
  });
});

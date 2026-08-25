import { parseDeactivatedUserId } from "./api-messages";

describe("parseDeactivatedUserId", () => {
  it("extrai o id do 409 que oferece restauração", () => {
    const message =
      "agent@acme.com belongs to a deactivated user (95e8836c-9c1e-4c1f-93a1-0b0b0d1a2b3c). Restore them instead of creating a duplicate.";

    expect(parseDeactivatedUserId(message)).toBe(
      "95e8836c-9c1e-4c1f-93a1-0b0b0d1a2b3c",
    );
  });

  it("devolve null para o outro 409, que não tem saída", () => {
    expect(parseDeactivatedUserId("agent@acme.com is already in use")).toBeNull();
  });

  it("devolve null para qualquer outra mensagem", () => {
    expect(parseDeactivatedUserId("This user is already deactivated")).toBeNull();
  });
});

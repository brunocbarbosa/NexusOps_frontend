import {
  PASSWORD_MAX_BYTES,
  passwordByteLength,
  validateEmail,
  validatePassword,
  validateTenantDomain,
} from "./validation";

describe("passwordByteLength", () => {
  it("conta bytes, não caracteres — um emoji custa quatro", () => {
    expect(passwordByteLength("abcdefgh")).toBe(8);
    expect(passwordByteLength("🔒")).toBe(4);
    expect(passwordByteLength("ção")).toBe(5);
  });
});

describe("validatePassword", () => {
  it("aceita uma senha dentro da política", () => {
    expect(validatePassword("correct horse battery")).toBeNull();
  });

  it("recusa menos de 8 caracteres", () => {
    expect(validatePassword("short")).toMatch(/at least 8 characters/);
  });

  it("aceita exatamente 72 bytes", () => {
    expect(validatePassword("a".repeat(PASSWORD_MAX_BYTES))).toBeNull();
  });

  it("recusa 73 bytes", () => {
    expect(validatePassword("a".repeat(PASSWORD_MAX_BYTES + 1))).toMatch(
      /at most 72 bytes/,
    );
  });

  it("recusa 18 emojis: 18 caracteres, 72 bytes está no limite — 19 estoura", () => {
    // O caso que um `maxLength(72)` deixaria passar: 19 emojis são 19
    // caracteres e 76 bytes, dos quais o bcrypt guardaria 72.
    expect(validatePassword("🔒".repeat(18))).toBeNull();
    expect(validatePassword("🔒".repeat(19))).toMatch(/at most 72 bytes/);
  });
});

describe("validateEmail", () => {
  it.each(["admin@acme.com", " admin@acme.com "])("aceita %p", (value) => {
    expect(validateEmail(value)).toBeNull();
  });

  it.each(["", "admin", "admin@acme"])("recusa %p", (value) => {
    expect(validateEmail(value)).not.toBeNull();
  });
});

describe("validateTenantDomain", () => {
  it("aceita um hostname curto ou completo", () => {
    expect(validateTenantDomain("acme")).toBeNull();
    expect(validateTenantDomain("acme.com")).toBeNull();
  });

  it("recusa vazio e menor que três caracteres", () => {
    expect(validateTenantDomain("")).toMatch(/required/);
    expect(validateTenantDomain("ac")).toMatch(/between 3 and 100/);
  });
});

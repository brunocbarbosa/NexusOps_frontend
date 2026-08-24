/**
 * Validação dos formulários de identity.
 *
 * Espelha as regras do backend, e cada função devolve `null` quando está tudo
 * certo ou a mensagem a exibir. Validar aqui não substitui o backend — só evita
 * um round-trip para dizer o óbvio.
 */

export const PASSWORD_MIN_LENGTH = 8;

/**
 * **Bytes, não caracteres.** O bcrypt ignora em silêncio tudo depois do byte
 * 72: duas senhas longas que compartilhem os primeiros 72 bytes viram a mesma
 * credencial. Um emoji custa quatro bytes, então `maxLength = 72` deixaria
 * passar 288 bytes dos quais o bcrypt guardaria 18.
 */
export const PASSWORD_MAX_BYTES = 72;

const encoder = new TextEncoder();

export function passwordByteLength(value: string): number {
  return encoder.encode(value).length;
}

export function validatePassword(value: string): string | null {
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }

  if (passwordByteLength(value) > PASSWORD_MAX_BYTES) {
    return `Password must be at most ${PASSWORD_MAX_BYTES} bytes. Accented letters and emoji count as more than one byte.`;
  }

  return null;
}

export function validateEmail(value: string): string | null {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return "Email is required.";
  }

  // Deliberadamente frouxo: quem decide o que é um email válido é o backend, e
  // uma regex ambiciosa aqui só rejeitaria endereços legítimos.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return "Enter a valid email address.";
  }

  return null;
}

export function validateTenantDomain(value: string): string | null {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return "Company domain is required.";
  }

  if (trimmed.length < 3 || trimmed.length > 100) {
    return "Company domain must be between 3 and 100 characters.";
  }

  return null;
}

export function validateRequired(value: string, label: string): string | null {
  return value.trim().length === 0 ? `${label} is required.` : null;
}

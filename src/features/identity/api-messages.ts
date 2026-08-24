/**
 * Leitura das mensagens de erro que o backend devolve com informação dentro.
 */

const DEACTIVATED_USER =
  /belongs to a deactivated user \(([0-9a-fA-F-]{36})\)/;

/**
 * O 409 de email ocupado tem duas formas, e só uma delas tem saída:
 *
 *   `agent@acme.com is already in use`
 *   `agent@acme.com belongs to a deactivated user (95e8836c-…). Restore them…`
 *
 * A segunda carrega o id justamente para a UI oferecer "restaurar" em vez de um
 * beco sem saída — um usuário desativado continua ocupando o endereço, então
 * criar um substituto é impossível e restaurar é o caminho pretendido.
 */
export function parseDeactivatedUserId(message: string): string | null {
  return DEACTIVATED_USER.exec(message)?.[1] ?? null;
}

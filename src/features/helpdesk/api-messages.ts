/**
 * Leitura das mensagens de erro do helpdesk que carregam informação dentro.
 *
 * Mesma razão de `identity/api-messages.ts`: a mensagem do backend traz um dado
 * de que a UI precisa, e lê-lo num lugar só é o que impede quatro telas de
 * discordarem sobre o formato.
 */

const VERSION_CONFLICT = /it is now at version (\d+)\)/;

/**
 * A versão atual do chamado, quando o 409 é conflito de concorrência.
 *
 * **Nem todo 409 é este.** O mesmo status cobre a transição ilegal
 * ("A ticket cannot go from RESOLVED to IN_PROGRESS"), o assignee que é
 * `REQUESTER`, e o chamado fechado que recusa comentário — nenhum deles se
 * resolve recarregando, e oferecer "reaplicar" para eles mandaria a pessoa
 * repetir uma requisição que vai falhar de novo.
 *
 * `null` significa exatamente isso: é outro 409, mostre a mensagem como veio.
 */
export function parseVersionConflict(message: string): number | null {
  const matched = VERSION_CONFLICT.exec(message);

  return matched ? Number(matched[1]) : null;
}

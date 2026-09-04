/**
 * O jsdom não tem motor de layout: **todo** elemento mede 0, e `offsetWidth` e
 * `offsetHeight` são getters que devolvem zero para sempre.
 *
 * Para o Radix isso não importa — posicionar um popover sobre zeros ainda o
 * renderiza. Para o `@tanstack/react-virtual` importa tudo: ele decide quais
 * linhas existem a partir da altura da janela de scroll, e com altura zero a
 * resposta correta é "nenhuma". A lista virtualizada renderiza um container
 * vazio, e um teste que procurasse uma linha falharia dizendo que o dado não
 * chegou — quando o que faltou foi a régua.
 *
 * Duas coisas que custaram tempo e ficam registradas:
 *
 * - **`initialRect` no virtualizador não resolve.** O `observeElementRect` do
 *   próprio react-virtual sobrescreve a medida inicial assim que o elemento
 *   monta, e a sobrescrita é zero.
 * - **Não é `getBoundingClientRect`.** O `getRect` do `virtual-core` lê
 *   `offsetWidth`/`offsetHeight`; um dublê do rect não é consultado.
 *
 * Fica no teste porque a lacuna é do ambiente. Chame no `beforeEach` de
 * qualquer suíte que renderize lista virtualizada.
 */

const VIEWPORT = { width: 960, height: 640 };

export function giveJsdomLayout(): void {
  Object.defineProperties(HTMLElement.prototype, {
    offsetWidth: { configurable: true, get: () => VIEWPORT.width },
    offsetHeight: { configurable: true, get: () => VIEWPORT.height },
  });
}

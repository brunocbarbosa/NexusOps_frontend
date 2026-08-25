import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "node:util";

/**
 * O jsdom não expõe `TextEncoder`/`TextDecoder`, que existem em todo navegador
 * desde 2018 e no Node desde a v11. A ausência é do ambiente de teste, não do
 * alvo: a contagem de bytes da senha (bcrypt trunca em 72 **bytes**) depende
 * deles em produção.
 */
Object.assign(globalThis, {
  TextEncoder: globalThis.TextEncoder ?? TextEncoder,
  TextDecoder: globalThis.TextDecoder ?? TextDecoder,
});

/**
 * O jsdom também não implementa a Pointer Events API nem `scrollIntoView`, e o
 * Radix depende dos dois para abrir um `Select` ou um `DropdownMenu`. Sem estes
 * dublês, `userEvent.click` no gatilho morre com
 * `target.hasPointerCapture is not a function` e o menu nunca aparece — de novo
 * uma lacuna do ambiente, não do alvo: no navegador ambos existem.
 */
const noop = (): void => undefined;

// Guardado: os testes de Route Handler declaram `@jest-environment node`, e lá
// não existe `Element` nenhum.
if (typeof Element !== "undefined") {
  Object.assign(Element.prototype, {
    hasPointerCapture: (): boolean => false,
    setPointerCapture: noop,
    releasePointerCapture: noop,
    scrollIntoView: noop,
  });
}

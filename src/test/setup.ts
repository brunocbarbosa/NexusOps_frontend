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

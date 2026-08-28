import { ConfigurationError } from "./errors";

/**
 * Onde o NestJS está. Só o servidor lê isto — nenhuma variável `NEXT_PUBLIC_`
 * expõe a API ao browser, porque o browser não deve alcançá-la.
 *
 * **Sem default de propósito.** O valor óbvio seria `http://localhost:3000`, que
 * é a porta do próprio Next: o servidor passaria a chamar a si mesmo, o
 * `proxy.ts` responderia 307 para `/login`, o `fetch` seguiria o redirect e o
 * handler tentaria ler HTML como JSON — e o diagnóstico que sobra é um 502
 * "The NexusOps API is unreachable" sobre uma API que nunca foi procurada.
 * Lançar um `ConfigurationError` aqui troca isso por um 500 que o operador lê
 * como "este processo está quebrado", com o nome da variável no log.
 */
export function apiBaseUrl(): string {
  const configured = process.env.NEXUSOPS_API_URL?.trim();

  if (!configured) {
    throw new ConfigurationError(
      "NEXUSOPS_API_URL is not set. Point it at the NexusOps API — see .env.example.",
    );
  }

  // Barra final duplicada faz o Nest responder 404 numa rota que existe.
  return configured.replace(/\/+$/, "");
}

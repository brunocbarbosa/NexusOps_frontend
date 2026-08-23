/**
 * Onde o NestJS está. Só o servidor lê isto — nenhuma variável `NEXT_PUBLIC_`
 * expõe a API ao browser, porque o browser não deve alcançá-la.
 */
export function apiBaseUrl(): string {
  const configured = process.env.NEXUSOPS_API_URL ?? "http://localhost:3000";

  // Barra final duplicada faz o Nest responder 404 numa rota que existe.
  return configured.replace(/\/+$/, "");
}

/**
 * Liveness probe. Existe para o HEALTHCHECK da imagem Docker e para o readiness
 * de qualquer orquestrador — não é endpoint de produto.
 *
 * Deliberadamente não toca no backend NestJS: a pergunta que responde é "este
 * processo Next está servindo?", não "a API está de pé?". Encadear as duas
 * faria uma indisponibilidade da API reiniciar containers de frontend que estão
 * perfeitamente saudáveis.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" });
}

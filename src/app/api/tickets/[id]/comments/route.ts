import { pickBooleans, pickStrings, readJsonBody } from "@/lib/api/payload";
import { jsonError, proxyToApi } from "@/lib/api/route-proxy";

/**
 * Escrever na thread. A leitura não passa por aqui: quem monta o feed é
 * `/api/tickets/:id/history`, que junta a thread com a trilha de auditoria.
 *
 * `isInternal` é lido por `pickBooleans` e não por `pickStrings`, e isso é a
 * diferença entre um comentário e uma nota interna. Medido no backend: o
 * `enableImplicitConversion` do `ValidationPipe` converte o **corpo JSON**
 * também, pelo tipo declarado e não pelo valor — antes da correção lá,
 * `{"isInternal": "false"}` chegava ao serviço como `true`, e alguém pedindo um
 * comentário visível ganhava um escondido. Daqui só sai booleano de verdade.
 *
 * Quem pode escrever uma nota interna é o backend que decide: um `REQUESTER`
 * recebe **403**, não 404, porque o chamado é dele e o que falta é só o papel.
 */
export async function POST(
  request: Request,
  context: RouteContext<"/api/tickets/[id]/comments">,
): Promise<Response> {
  const { id } = await context.params;
  const raw = await readJsonBody(request);

  const body = pickStrings(raw, ["body"]).body?.trim();
  if (!body) {
    return jsonError(400, "A comment cannot be empty.");
  }

  const { isInternal } = pickBooleans(raw, ["isInternal"]);

  return proxyToApi(`/tickets/${encodeURIComponent(id)}/comments`, {
    method: "POST",
    body: { body, ...(isInternal === undefined ? {} : { isInternal }) },
  });
}

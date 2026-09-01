import { isTicketStatus } from "@/features/helpdesk/types";
import {
  pickPositiveIntegers,
  pickStrings,
  readJsonBody,
} from "@/lib/api/payload";
import { jsonError, proxyToApi } from "@/lib/api/route-proxy";

/**
 * Mover o chamado pelo ciclo de vida. Exige ADMIN ou AGENT — um `REQUESTER`
 * recebe 403 aqui, e o 403 é honesto: o chamado é visível, a ação é que não.
 *
 * Os efeitos colaterais são do servidor e não se mandam: `RESOLVED` carimba
 * `resolvedAt`, `OPEN` o apaga (reabrir descarta a alegação), e `CLOSED` carimba
 * `closedAt` e `closedBy` — mantendo o `resolvedAt`, porque quando o trabalho
 * terminou é o ponto de um relatório de tempo de resolução, e fechar é um ato
 * administrativo posterior.
 */
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/tickets/[id]/status">,
): Promise<Response> {
  const { id } = await context.params;
  const raw = await readJsonBody(request);

  const { version } = pickPositiveIntegers(raw, ["version"]);
  if (version === undefined) {
    return jsonError(400, "A version is required to change the status.");
  }

  const { status } = pickStrings(raw, ["status"]);
  if (!isTicketStatus(status)) {
    return jsonError(400, "A valid status is required.");
  }

  return proxyToApi(`/tickets/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: { status, version },
  });
}

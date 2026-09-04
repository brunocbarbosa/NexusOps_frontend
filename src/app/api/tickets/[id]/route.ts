import {
  isTicketCategory,
  isTicketPriority,
} from "@/features/helpdesk/types";
import {
  pickPositiveIntegers,
  pickStrings,
  readJsonBody,
} from "@/lib/api/payload";
import { jsonError, proxyToApi } from "@/lib/api/route-proxy";

/**
 * Um chamado: ler e editar.
 *
 * **Não existe `DELETE`.** `CLOSED` é o estado terminal e toma o lugar que um
 * delete teria — um chamado é o assunto de uma trilha de auditoria, e apagá-lo
 * apagaria aquilo de que a trilha fala.
 *
 * `status` e `assigneeId` não são aceitos aqui: têm rotas próprias, que exigem
 * ADMIN ou AGENT. Aceitá-los nesta não os faria funcionar — seria 400 por campo
 * não declarado —, e daria a impressão de que um requester pode fechar o
 * próprio chamado.
 */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/tickets/[id]">,
): Promise<Response> {
  const { id } = await context.params;

  return proxyToApi(`/tickets/${encodeURIComponent(id)}`);
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/tickets/[id]">,
): Promise<Response> {
  const { id } = await context.params;
  const raw = await readJsonBody(request);

  const { version } = pickPositiveIntegers(raw, ["version"]);
  if (version === undefined) {
    return jsonError(400, "A version is required to update a ticket.");
  }

  // `description` entra por `!== undefined` e não por veracidade: string vazia
  // é uma edição legítima — apagar o texto —, e tratá-la como ausência deixaria
  // o campo impossível de limpar.
  const { title, description, priority, category } = pickStrings(raw, [
    "title",
    "description",
    "priority",
    "category",
  ]);

  const changes = {
    ...(title === undefined ? {} : { title }),
    ...(description === undefined ? {} : { description }),
    ...(isTicketPriority(priority) ? { priority } : {}),
    ...(isTicketCategory(category) ? { category } : {}),
  };

  if (Object.keys(changes).length === 0) {
    return jsonError(400, "Nothing to update.");
  }

  return proxyToApi(`/tickets/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { ...changes, version },
  });
}

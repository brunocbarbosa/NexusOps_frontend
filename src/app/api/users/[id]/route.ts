import { pickStrings, readJsonBody } from "@/lib/api/payload";
import { jsonError, proxyToApi } from "@/lib/api/route-proxy";

/**
 * Um usuário: ler, alterar e desativar.
 *
 * `DELETE` desativa — o registro sobrevive com `deletedAt` preenchido, porque
 * as FKs de `audit_logs` e `tickets.assignee` são `RESTRICT` e um delete de
 * verdade falharia no banco.
 */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/users/[id]">,
): Promise<Response> {
  const { id } = await context.params;

  return proxyToApi(`/users/${encodeURIComponent(id)}`);
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/users/[id]">,
): Promise<Response> {
  const { id } = await context.params;

  // Não existe `password` aqui, de propósito: trocar a senha de outra pessoa
  // pela mesma rota que a renomeia é como uma ação de admin larga demais vira
  // sequestro de conta. Senha só em PATCH /users/me/password.
  const payload = pickStrings(await readJsonBody(request), ["email", "role"]);

  if (Object.keys(payload).length === 0) {
    return jsonError(400, "Nothing to update.");
  }

  return proxyToApi(`/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/users/[id]">,
): Promise<Response> {
  const { id } = await context.params;

  return proxyToApi(`/users/${encodeURIComponent(id)}`, { method: "DELETE" });
}

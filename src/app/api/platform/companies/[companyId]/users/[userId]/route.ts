import { pickStrings, readJsonBody } from "@/lib/api/payload";
import { jsonError, proxyToApi } from "@/lib/api/route-proxy";

type Context = RouteContext<"/api/platform/companies/[companyId]/users/[userId]">;

function userPath(companyId: string, userId: string): string {
  return `/platform/companies/${encodeURIComponent(companyId)}/users/${encodeURIComponent(userId)}`;
}

export async function PATCH(
  request: Request,
  context: Context,
): Promise<Response> {
  const { companyId, userId } = await context.params;

  // Sem `password`, como em `/users/:id`: trocar a senha de outra pessoa pela
  // mesma rota que a renomeia é como uma ação de admin larga demais vira
  // sequestro de conta. O operador também não faz isso.
  const payload = pickStrings(await readJsonBody(request), ["email", "role"]);

  if (Object.keys(payload).length === 0) {
    return jsonError(400, "Nothing to update.");
  }

  return proxyToApi(userPath(companyId, userId), {
    method: "PATCH",
    body: payload,
  });
}

/** Desativa — soft delete, reversível pelo `/restore` ao lado. */
export async function DELETE(
  _request: Request,
  context: Context,
): Promise<Response> {
  const { companyId, userId } = await context.params;

  return proxyToApi(userPath(companyId, userId), { method: "DELETE" });
}

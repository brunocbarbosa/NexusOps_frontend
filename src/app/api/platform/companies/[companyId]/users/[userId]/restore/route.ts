import { proxyToApi } from "@/lib/api/route-proxy";

/**
 * Reativa um usuário desativado de uma company.
 *
 * Traz **a mesma linha** de volta, com o histórico preso a ela. O email nunca
 * chegou a ser liberado, então restaurar não pode colidir — e é por isso que o
 * 409 de "já existe um desativado com este email" oferece esta rota em vez de
 * pedir outro endereço.
 */
export async function POST(
  _request: Request,
  context: RouteContext<"/api/platform/companies/[companyId]/users/[userId]/restore">,
): Promise<Response> {
  const { companyId, userId } = await context.params;

  return proxyToApi(
    `/platform/companies/${encodeURIComponent(companyId)}/users/${encodeURIComponent(userId)}/restore`,
    { method: "POST" },
  );
}

import { proxyToApi } from "@/lib/api/route-proxy";

/**
 * Reativa um usuário desativado.
 *
 * Traz **a mesma linha** de volta, com o histórico ainda preso a ela — que é o
 * que um novo cadastro não daria. E não pode colidir no email: o endereço ficou
 * ocupado o tempo todo, então ninguém pôde tomá-lo.
 */
export async function POST(
  _request: Request,
  context: RouteContext<"/api/users/[id]/restore">,
): Promise<Response> {
  const { id } = await context.params;

  return proxyToApi(`/users/${encodeURIComponent(id)}/restore`, {
    method: "POST",
  });
}

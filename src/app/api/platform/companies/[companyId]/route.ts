import { pickBooleans, pickStrings, readJsonBody } from "@/lib/api/payload";
import { jsonError, proxyToApi } from "@/lib/api/route-proxy";

type Context = RouteContext<"/api/platform/companies/[companyId]">;

export async function GET(
  _request: Request,
  context: Context,
): Promise<Response> {
  const { companyId } = await context.params;

  return proxyToApi(`/platform/companies/${encodeURIComponent(companyId)}`);
}

/**
 * Renomear, trocar de domínio, e **bloquear**.
 *
 * `isActive: false` é a suspensão: todos os usuários daquela company passam a
 * ser recusados no login com o 401 genérico, nenhuma linha de usuário é tocada,
 * e `true` desfaz. É o oposto do `DELETE` abaixo em tudo que importa.
 *
 * Ele é booleano de verdade no corpo, então precisa de `pickBooleans` —
 * `pickStrings` o descartaria e o PATCH viraria "nada para atualizar".
 */
export async function PATCH(
  request: Request,
  context: Context,
): Promise<Response> {
  const { companyId } = await context.params;
  const raw = await readJsonBody(request);
  const payload = {
    ...pickStrings(raw, ["name", "domain"]),
    ...pickBooleans(raw, ["isActive"]),
  };

  if (Object.keys(payload).length === 0) {
    return jsonError(400, "Nothing to update.");
  }

  return proxyToApi(`/platform/companies/${encodeURIComponent(companyId)}`, {
    method: "PATCH",
    body: payload,
  });
}

/**
 * Apaga de verdade: company, usuários, chamados, comentários e a trilha de
 * auditoria inteira, por cascade no banco. Não há rota de restauração.
 *
 * Quem quer desfazer depois quer o `PATCH { isActive: false }` acima.
 */
export async function DELETE(
  _request: Request,
  context: Context,
): Promise<Response> {
  const { companyId } = await context.params;

  return proxyToApi(`/platform/companies/${encodeURIComponent(companyId)}`, {
    method: "DELETE",
  });
}

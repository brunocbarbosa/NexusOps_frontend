import { pickStrings, readJsonBody } from "@/lib/api/payload";
import { jsonError, proxyToApi } from "@/lib/api/route-proxy";

/**
 * Troca da própria senha — o único caminho para trocar senha em todo o sistema.
 *
 * Exige a senha atual e **encerra todas as sessões** do usuário: todos os
 * refresh tokens são revogados. É por isso que a tela desloga logo em seguida;
 * o access token atual sobreviveria uns 15 minutos e depois morreria sem aviso.
 */
export async function PATCH(request: Request): Promise<Response> {
  const payload = pickStrings(await readJsonBody(request), [
    "currentPassword",
    "newPassword",
  ]);

  if (!payload.currentPassword || !payload.newPassword) {
    return jsonError(400, "Current and new password are required.");
  }

  return proxyToApi("/users/me/password", { method: "PATCH", body: payload });
}

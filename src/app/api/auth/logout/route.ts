import { apiFetch } from "@/lib/api/server";
import { clearTokens, readTokens } from "@/lib/api/session";

/**
 * Encerra a sessão atual.
 *
 * Apagar os cookies acontece de qualquer jeito: se o backend estiver fora do
 * ar, o usuário ainda tem de conseguir sair. O `POST /auth/logout` é o que
 * revoga o refresh token do outro lado — sem ele o cookie some mas a sessão
 * continuaria válida por sete dias.
 */
export async function POST(): Promise<Response> {
  const { accessToken, refreshToken } = await readTokens();

  if (accessToken && refreshToken) {
    try {
      await apiFetch("/auth/logout", {
        method: "POST",
        body: { refreshToken },
        refreshOnUnauthorized: false,
      });
    } catch {
      // Best effort: o cookie some abaixo de qualquer forma.
    }
  }

  await clearTokens();

  return new Response(null, { status: 204 });
}

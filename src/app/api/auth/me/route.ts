import { proxyToApi } from "@/lib/api/route-proxy";

/**
 * A identidade do chamador — e a **fonte autoritativa do papel**.
 *
 * O backend relê a linha do usuário a cada requisição, então um ADMIN
 * rebaixado há trinta segundos já é AGENT aqui, enquanto o access token dele
 * ainda diria ADMIN por até 15 minutos. Nenhuma tela decodifica o JWT.
 */
export async function GET(): Promise<Response> {
  return proxyToApi("/auth/me");
}

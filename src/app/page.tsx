import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { SessionLanding } from "@/features/identity/components/session-landing";
import { REFRESH_TOKEN_COOKIE } from "@/lib/api/cookie-names";

/**
 * A raiz não tem conteúdo próprio: é o despachante.
 *
 * Sem cookie, o caminho é decidido aqui mesmo — o `proxy.ts` faria o mesmo, e
 * uma pessoa deslogada não precisa esperar o cliente hidratar para ver o login.
 *
 * Com cookie, quem decide é `<SessionLanding />`, no cliente: são dois consoles
 * e este Server Component não pode descobrir o papel. Buscar `/auth/me` daqui
 * renovaria a sessão sem conseguir gravar o par rotacionado, e reapresentar o
 * refresh token velho é o que faz o backend revogar a família inteira.
 */
export default async function RootPage() {
  const signedIn = (await cookies()).has(REFRESH_TOKEN_COOKIE);

  if (!signedIn) {
    redirect("/login");
  }

  return <SessionLanding />;
}

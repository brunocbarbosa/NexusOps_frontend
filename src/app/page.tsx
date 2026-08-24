import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { REFRESH_TOKEN_COOKIE } from "@/lib/api/cookie-names";

/**
 * A raiz não tem conteúdo próprio: manda para a aplicação ou para o login.
 *
 * O `proxy.ts` já faria o mesmo para quem chega sem sessão; esta página é o que
 * decide para onde vai quem **tem** sessão.
 */
export default async function RootPage() {
  const signedIn = (await cookies()).has(REFRESH_TOKEN_COOKIE);

  redirect(signedIn ? "/users" : "/login");
}

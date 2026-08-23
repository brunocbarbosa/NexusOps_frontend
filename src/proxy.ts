import { NextResponse, type NextRequest } from "next/server";

import { REFRESH_TOKEN_COOKIE } from "@/lib/api/cookie-names";
import { applySecurityHeaders } from "@/lib/security-headers";

/**
 * Porteiro de rotas e cabeçalhos de segurança.
 *
 * `proxy.ts` é o nome do arquivo no Next 16 — `middleware.ts` foi depreciado e
 * renomeado (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`).
 *
 * Ele decide pela **presença** do cookie de refresh e não renova nada. Renovar
 * aqui seria um erro de dois lados: a doc avisa que o proxy pode ser
 * distribuído para a CDN e não deve depender de estado de módulo — que é
 * exatamente o que serializa o refresh —, e o cookie de access expira antes do
 * de refresh, então "sem access token" é estado normal de quem está logado.
 */

const LOGIN_PATH = "/login";

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;

  // As rotas de /api respondem em JSON e cuidam do próprio 401. Redirecionar
  // um `fetch` para uma página HTML transformaria "sessão vencida" em erro de
  // parsing na tela.
  if (pathname.startsWith("/api/")) {
    return applySecurityHeaders(NextResponse.next());
  }

  const signedIn = request.cookies.has(REFRESH_TOKEN_COOKIE);
  const isLogin = pathname === LOGIN_PATH;

  if (!signedIn && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.search = "";

    // Guarda para onde a pessoa queria ir; a raiz não vale a pena guardar.
    if (pathname !== "/") {
      url.searchParams.set("next", `${pathname}${search}`);
    }

    return applySecurityHeaders(NextResponse.redirect(url));
  }

  if (signedIn && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/users";
    url.search = "";

    return applySecurityHeaders(NextResponse.redirect(url));
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    // Tudo, menos os estáticos do build e os arquivos de public/. O
    // `/api/health` fica de fora porque é liveness probe: um redirect ali
    // faria o HEALTHCHECK da imagem reiniciar containers saudáveis.
    "/((?!_next/static|_next/image|api/health|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

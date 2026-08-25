/**
 * Cabeçalhos de segurança aplicados a toda resposta pelo `proxy.ts`.
 *
 * Não há CSP aqui, e a ausência é deliberada: com o Next, CSP exige um nonce
 * por requisição, o que obriga renderização dinâmica em toda página. É uma
 * mudança com consequência de performance própria e merece uma fatia só dela —
 * ver `documents/specs/2026-08-23-identity-login-users-design.md` §3.4.
 */
const SECURITY_HEADERS: ReadonlyArray<readonly [string, string]> = [
  // Dois anos, como pede a lista de preload dos navegadores. Sem efeito em
  // http://localhost — o cabeçalho só vale sobre HTTPS.
  ["Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload"],
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  // Nenhuma tela deste produto é feita para ser embutida; DENY fecha
  // clickjacking sem depender de CSP.
  ["X-Frame-Options", "DENY"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=()"],
];

export function applySecurityHeaders<T extends Response>(response: T): T {
  for (const [name, value] of SECURITY_HEADERS) {
    response.headers.set(name, value);
  }

  return response;
}

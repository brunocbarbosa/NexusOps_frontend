/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";

import { proxy } from "./proxy";

function request(path: string, options: { signedIn?: boolean } = {}): NextRequest {
  const nextRequest = new NextRequest(`http://localhost:3001${path}`);

  if (options.signedIn) {
    nextRequest.cookies.set("nexusops_rt", "refresh-1");
  }

  return nextRequest;
}

describe("proxy", () => {
  it("manda quem não tem sessão para o login, guardando o destino", () => {
    const response = proxy(request("/users?page=2"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/users?page=2");
  });

  it("não guarda a raiz como destino", () => {
    const response = proxy(request("/"));

    const location = new URL(response.headers.get("location") ?? "");
    expect(location.searchParams.has("next")).toBe(false);
  });

  it("deixa passar quem tem o cookie de refresh, mesmo sem o de access", () => {
    // Estado normal de quem está logado há mais de 15 minutos: o access token
    // expirou e a renovação acontece no Route Handler, não aqui.
    const response = proxy(request("/users", { signedIn: true }));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("tira de /login quem já tem sessão", () => {
    const response = proxy(request("/login", { signedIn: true }));

    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/users");
  });

  it("deixa o login aberto para quem não tem sessão", () => {
    expect(proxy(request("/login")).status).toBe(200);
  });

  it("não redireciona /api: aquelas rotas respondem 401 em JSON", () => {
    const response = proxy(request("/api/users"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("aplica os cabeçalhos de segurança em toda resposta", () => {
    for (const response of [
      proxy(request("/users")),
      proxy(request("/login")),
      proxy(request("/api/users")),
    ]) {
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("x-frame-options")).toBe("DENY");
      expect(response.headers.get("referrer-policy")).toBe(
        "strict-origin-when-cross-origin",
      );
      expect(response.headers.get("strict-transport-security")).toContain("max-age=");
      expect(response.headers.get("permissions-policy")).toContain("camera=()");
    }
  });
});

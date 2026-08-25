import type { NextRequest } from "next/server";

import { isAssignableRole } from "@/features/identity/types";
import { pickStrings, readJsonBody } from "@/lib/api/payload";
import { jsonError, proxyToApi } from "@/lib/api/route-proxy";

/**
 * Listagem e criação de usuários.
 *
 * A query string é remontada campo a campo em vez de repassada: o backend
 * recusa parâmetro desconhecido com 400, e `includeDeleted` precisa chegar como
 * o **texto** `'true'` ou `'false'` — omitir esperando um default implícito, ou
 * mandar outra coisa, muda a resposta ou reprova a requisição.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const incoming = request.nextUrl.searchParams;
  const searchParams = new URLSearchParams();

  const page = positiveInteger(incoming.get("page"));
  if (page) {
    searchParams.set("page", String(page));
  }

  const perPage = positiveInteger(incoming.get("perPage"));
  if (perPage) {
    // Teto do backend. Mandar mais é 400, não um clamp silencioso.
    searchParams.set("perPage", String(Math.min(perPage, 100)));
  }

  const role = incoming.get("role");
  if (isAssignableRole(role)) {
    searchParams.set("role", role);
  }

  const search = incoming.get("search")?.trim();
  if (search) {
    searchParams.set("search", search);
  }

  if (incoming.get("includeDeleted") === "true") {
    searchParams.set("includeDeleted", "true");
  }

  return proxyToApi("/users", { searchParams });
}

export async function POST(request: Request): Promise<Response> {
  const payload = pickStrings(await readJsonBody(request), [
    "email",
    "password",
    "role",
  ]);

  if (!payload.email || !payload.password) {
    return jsonError(400, "Email and password are required.");
  }

  return proxyToApi("/users", {
    method: "POST",
    body: payload.role
      ? payload
      : // `role` ausente vale REQUESTER no backend, que é o menos privilegiado
        // de propósito. Mandar string vazia seria 400.
        { email: payload.email, password: payload.password },
  });
}

function positiveInteger(value: string | null): number | null {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

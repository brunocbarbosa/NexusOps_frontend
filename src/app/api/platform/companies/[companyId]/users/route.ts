import type { NextRequest } from "next/server";

import { isAssignableRole } from "@/features/identity/types";
import { pickStrings, readJsonBody } from "@/lib/api/payload";
import { paginationSearchParams } from "@/lib/api/query";
import { jsonError, proxyToApi } from "@/lib/api/route-proxy";

type Context = RouteContext<"/api/platform/companies/[companyId]/users">;

/**
 * Os usuários de uma company, pelos olhos do operador.
 *
 * Roda o mesmo serviço de `/users` dentro do escopo daquela company, então os
 * payloads e os 409 são idênticos. Duas diferenças, ambas por quem chama:
 * `includeDeleted` é sempre permitido — restaurar exige achar primeiro — e o
 * seletor de papel continua oferecendo só os três atribuíveis.
 */
export async function GET(
  request: NextRequest,
  context: Context,
): Promise<Response> {
  const { companyId } = await context.params;
  const incoming = request.nextUrl.searchParams;
  const searchParams = paginationSearchParams(incoming);

  const role = incoming.get("role");
  if (isAssignableRole(role)) {
    searchParams.set("role", role);
  }

  if (incoming.get("includeDeleted") === "true") {
    searchParams.set("includeDeleted", "true");
  }

  return proxyToApi(
    `/platform/companies/${encodeURIComponent(companyId)}/users`,
    { searchParams },
  );
}

export async function POST(
  request: Request,
  context: Context,
): Promise<Response> {
  const { companyId } = await context.params;
  const payload = pickStrings(await readJsonBody(request), [
    "email",
    "password",
    "role",
  ]);

  if (!payload.email || !payload.password) {
    return jsonError(400, "Email and password are required.");
  }

  return proxyToApi(
    `/platform/companies/${encodeURIComponent(companyId)}/users`,
    {
      method: "POST",
      body: payload.role
        ? payload
        : { email: payload.email, password: payload.password },
    },
  );
}

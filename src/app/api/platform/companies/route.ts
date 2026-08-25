import type { NextRequest } from "next/server";

import {
  pickNested,
  pickStrings,
  readJsonBody,
} from "@/lib/api/payload";
import { paginationSearchParams, setBooleanFilter } from "@/lib/api/query";
import { jsonError, proxyToApi } from "@/lib/api/route-proxy";

/**
 * Companies: listar e criar. Só o `ADMIN_MASTER` chega aqui; qualquer outro
 * papel recebe 403 do backend, e a tela trata isso como estado.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const incoming = request.nextUrl.searchParams;
  const searchParams = paginationSearchParams(incoming);

  // Ausente significa "ativas e bloqueadas". Não existe valor para dizer
  // "as duas" — `''` e `'all'` são 400 lá.
  setBooleanFilter(searchParams, "isActive", incoming.get("isActive"));

  return proxyToApi("/platform/companies", { searchParams });
}

/**
 * O primeiro ADMIN vem no mesmo corpo, e isso não é conveniência de tela: uma
 * company sem ADMIN é uma em que ninguém entra, ninguém cria o primeiro usuário
 * e a guarda do "último ADMIN" nunca pode ser satisfeita. Não há rota de saída
 * desse estado, então a API não o deixa existir.
 */
export async function POST(request: Request): Promise<Response> {
  const raw = await readJsonBody(request);
  const company = pickStrings(raw, ["name", "domain"]);
  const admin = pickStrings(pickNested(raw, "admin"), ["email", "password"]);

  if (!company.name || !company.domain) {
    return jsonError(400, "Company name and domain are required.");
  }

  if (!admin.email || !admin.password) {
    return jsonError(400, "The first administrator's email and password are required.");
  }

  return proxyToApi("/platform/companies", {
    method: "POST",
    body: {
      name: company.name,
      domain: company.domain,
      admin: { email: admin.email, password: admin.password },
    },
  });
}

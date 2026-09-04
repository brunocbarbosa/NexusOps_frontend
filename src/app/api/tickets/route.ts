import type { NextRequest } from "next/server";

import {
  UNASSIGNED,
  isTicketCategory,
  isTicketPriority,
  isTicketStatus,
} from "@/features/helpdesk/types";
import { pickStrings, readJsonBody } from "@/lib/api/payload";
import { paginationSearchParams } from "@/lib/api/query";
import { jsonError, proxyToApi } from "@/lib/api/route-proxy";

/**
 * Listagem e abertura de chamados.
 *
 * A query string é remontada campo a campo: o `ValidationPipe` do backend
 * recusa parâmetro desconhecido com 400, e não existe parâmetro de ordenação —
 * a lista vem sempre do mais novo para o mais antigo.
 *
 * Quem é o requester **não** é decidido aqui: `POST /tickets` sempre abre o
 * chamado em nome de quem chamou. Não há como abrir em nome de outra pessoa,
 * então um `requesterId` no corpo só poderia ser um engano — e reprovaria a
 * requisição inteira.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const incoming = request.nextUrl.searchParams;
  const searchParams = paginationSearchParams(incoming);

  const status = incoming.get("status");
  if (isTicketStatus(status)) {
    searchParams.set("status", status);
  }

  const priority = incoming.get("priority");
  if (isTicketPriority(priority)) {
    searchParams.set("priority", priority);
  }

  const category = incoming.get("category");
  if (isTicketCategory(category)) {
    searchParams.set("category", category);
  }

  // Um campo só, e não dois. `unassigned` e `assigneeId` se contradizem — mandar
  // os dois é 400 —, então a requisição contraditória nem é construível daqui.
  const assignee = incoming.get("assignee");
  if (assignee === UNASSIGNED) {
    searchParams.set("unassigned", "true");
  } else if (assignee) {
    searchParams.set("assigneeId", assignee);
  }

  return proxyToApi("/tickets", { searchParams });
}

export async function POST(request: Request): Promise<Response> {
  const raw = await readJsonBody(request);
  const { title, description } = pickStrings(raw, ["title", "description"]);

  if (!title) {
    return jsonError(400, "A title is required.");
  }

  const { priority, category } = pickStrings(raw, ["priority", "category"]);

  return proxyToApi("/tickets", {
    method: "POST",
    body: {
      title,
      ...(description ? { description } : {}),
      // Ausente vale o default do backend (MEDIUM, OTHER). Um valor fora do
      // contrato vira ausência em vez de 400: a tela só oferece os do enum, e
      // um valor estranho aqui é bug de chamador, não escolha do usuário.
      ...(isTicketPriority(priority) ? { priority } : {}),
      ...(isTicketCategory(category) ? { category } : {}),
    },
  });
}

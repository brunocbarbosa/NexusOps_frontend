import { mergeHistory } from "@/features/helpdesk/history";
import type { AuditEntry, Comment } from "@/features/helpdesk/types";
import type { Page } from "@/lib/api/page";
import { errorResponse } from "@/lib/api/route-proxy";
import { apiFetch } from "@/lib/api/server";

/**
 * A linha do tempo do chamado, já intercalada.
 *
 * O backend mantém `/timeline` (as mudanças) e `/comments` (os textos)
 * separados de propósito, e o cliente precisa juntá-los por `createdAt`. A
 * junção acontece aqui, e não no browser, porque ordenar globalmente pede as
 * duas listas inteiras — no cliente seriam duas `useInfiniteQuery` avançando em
 * passo, uma máquina de estado inteira para um problema que o servidor resolve
 * com duas chamadas locais.
 *
 * As duas listas são buscadas em paralelo: elas não dependem uma da outra, e a
 * serialização do refresh em `refresh.ts` já cobre o par de requisições
 * concorrentes.
 */

/** O teto do backend. Pedir mais é 400, não um clamp silencioso. */
const PER_PAGE = 100;

/**
 * Um chamado com mais de 2000 entradas em qualquer das listas é patológico, e
 * uma resposta sem limite seria a forma errada de descobrir isso. A tela avisa
 * que truncou — mostrar um histórico incompleto como se fosse completo é o
 * único desfecho inaceitável.
 */
const MAX_PAGES = 20;

export async function GET(
  _request: Request,
  context: RouteContext<"/api/tickets/[id]/history">,
): Promise<Response> {
  const { id } = await context.params;
  const ticket = encodeURIComponent(id);

  try {
    const [entries, comments] = await Promise.all([
      collectAll<AuditEntry>(`/tickets/${ticket}/timeline`),
      collectAll<Comment>(`/tickets/${ticket}/comments`),
    ]);

    // Um 404 aqui é o chamado não sendo visível para quem perguntou — a
    // timeline resolve o chamado antes, e não é um canal lateral para o que a
    // listagem esconde. Repassar é o certo: um 200 com lista vazia afirmaria
    // que o chamado existe e está sem histórico.
    const rejected = entries.rejected ?? comments.rejected;
    if (rejected) {
      return await forward(rejected);
    }

    return Response.json({
      data: mergeHistory(entries.items, comments.items),
      truncated: entries.truncated || comments.truncated,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

interface Collected<T> {
  items: T[];
  truncated: boolean;
  rejected: Response | null;
}

async function collectAll<T>(path: string): Promise<Collected<T>> {
  const items: T[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const searchParams = new URLSearchParams({
      page: String(page),
      perPage: String(PER_PAGE),
    });

    const response = await apiFetch(path, { searchParams });

    if (!response.ok) {
      return { items, truncated: false, rejected: response };
    }

    const body = (await response.json()) as Page<T>;
    items.push(...body.data);

    if (body.meta.page >= body.meta.totalPages) {
      return { items, truncated: false, rejected: null };
    }
  }

  return { items, truncated: true, rejected: null };
}

/** Repassa a recusa do backend com status e corpo intactos. */
async function forward(rejected: Response): Promise<Response> {
  const body = await rejected.text();

  return new Response(body.length > 0 ? body : null, {
    status: rejected.status,
    headers: { "content-type": "application/json" },
  });
}

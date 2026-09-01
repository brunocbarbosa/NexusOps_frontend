import {
  pickPositiveIntegers,
  readJsonBody,
} from "@/lib/api/payload";
import { jsonError, proxyToApi } from "@/lib/api/route-proxy";

/**
 * Atribuir e desatribuir. Exige ADMIN ou AGENT.
 *
 * `assigneeId: null` é o valor que **remove** o responsável — não a ausência do
 * campo. `pickStrings` o descartaria e o `PATCH` viraria "nada para atualizar",
 * então a leitura é feita à mão, aceitando exatamente string ou `null`.
 */
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/tickets/[id]/assignee">,
): Promise<Response> {
  const { id } = await context.params;
  const raw = await readJsonBody(request);

  const { version } = pickPositiveIntegers(raw, ["version"]);
  if (version === undefined) {
    return jsonError(400, "A version is required to change the assignee.");
  }

  const assigneeId = readAssigneeId(raw);
  if (assigneeId === undefined) {
    return jsonError(400, "An assignee is required, or null to unassign.");
  }

  return proxyToApi(`/tickets/${encodeURIComponent(id)}/assignee`, {
    method: "PATCH",
    body: { assigneeId, version },
  });
}

/** `undefined` significa "não veio"; `null`, "desatribuir". */
function readAssigneeId(payload: unknown): string | null | undefined {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }

  const value: unknown = (payload as Record<string, unknown>).assigneeId;

  if (value === null) {
    return null;
  }

  return typeof value === "string" && value.length > 0 ? value : undefined;
}

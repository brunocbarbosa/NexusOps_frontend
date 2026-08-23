import { apiErrorFromResponse } from "@/lib/api/errors";
import { pickStrings, readJsonBody } from "@/lib/api/payload";
import { errorResponse, jsonError } from "@/lib/api/route-proxy";
import { apiFetchPublic } from "@/lib/api/server";
import { writeTokens } from "@/lib/api/session";
import type { User } from "@/features/identity/types";

/**
 * A troca de credenciais por sessão.
 *
 * O que o backend devolve — `{ accessToken, refreshToken, user }` — é partido
 * em dois aqui: os tokens viram cookies `httpOnly`, e só o `user` desce ao
 * browser. **Nenhum token aparece na resposta**, que é a razão de este handler
 * existir em vez de o formulário chamar o NestJS direto.
 */
export async function POST(request: Request): Promise<Response> {
  const payload = pickStrings(await readJsonBody(request), [
    "tenantDomain",
    "email",
    "password",
  ]);

  if (!payload.tenantDomain || !payload.email || !payload.password) {
    return jsonError(400, "Company domain, email and password are required.");
  }

  try {
    const response = await apiFetchPublic("/auth/login", {
      method: "POST",
      body: payload,
    });

    if (!response.ok) {
      // 401 idêntico para tenant inexistente, usuário inexistente e senha
      // errada — o backend não diferencia, nem no tempo de resposta, e a UI
      // não deve inventar uma distinção que não existe.
      const error = await apiErrorFromResponse(response);
      return jsonError(error.status, error.message);
    }

    const body: unknown = await response.json();

    if (!isAuthResult(body)) {
      return jsonError(502, "Unexpected response from the NexusOps API.");
    }

    await writeTokens(body);

    return Response.json({ user: body.user });
  } catch (error) {
    return errorResponse(error);
  }
}

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: User;
}

function isAuthResult(body: unknown): body is AuthResult {
  if (typeof body !== "object" || body === null) {
    return false;
  }

  const candidate = body as Partial<AuthResult>;

  return (
    typeof candidate.accessToken === "string" &&
    typeof candidate.refreshToken === "string" &&
    typeof candidate.user === "object" &&
    candidate.user !== null
  );
}

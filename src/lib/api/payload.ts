/**
 * O `ValidationPipe` do backend roda com `forbidNonWhitelisted`: um campo que
 * nenhum DTO declara não é ignorado, é **400**. Por isso todo handler monta o
 * corpo a partir de uma lista explícita em vez de repassar o que o browser
 * mandou — um `id` ecoado de volta pela UI reprovaria a requisição inteira.
 */
export function pickStrings<K extends string>(
  payload: unknown,
  keys: readonly K[],
): Partial<Record<K, string>> {
  if (typeof payload !== "object" || payload === null) {
    return {};
  }

  const source = payload as Record<string, unknown>;
  const picked: Partial<Record<K, string>> = {};

  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string") {
      picked[key] = value;
    }
  }

  return picked;
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}

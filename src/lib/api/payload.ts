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

/**
 * O irmão booleano de `pickStrings`, pela mesma razão de allowlist.
 *
 * `isActive` chega como booleano de verdade no corpo (diferente do filtro
 * homônimo na query string, que é texto), então `pickStrings` o descartaria em
 * silêncio e o PATCH viraria "nada para atualizar".
 */
export function pickBooleans<K extends string>(
  payload: unknown,
  keys: readonly K[],
): Partial<Record<K, boolean>> {
  if (typeof payload !== "object" || payload === null) {
    return {};
  }

  const source = payload as Record<string, unknown>;
  const picked: Partial<Record<K, boolean>> = {};

  for (const key of keys) {
    const value = source[key];
    if (typeof value === "boolean") {
      picked[key] = value;
    }
  }

  return picked;
}

/**
 * O irmão numérico, para a `version` do controle de concorrência otimista.
 *
 * `pickStrings` a descartaria em silêncio e o `PATCH` sairia sem ela — que o
 * backend recusa com um 400 de validação ("version must be an integer number"),
 * uma mensagem sem sentido para quem só editou um título.
 *
 * Só inteiro **positivo** passa: `version` começa em 1, e `"3"` vindo de um
 * `<input>` é bug do chamador, não um número.
 */
export function pickPositiveIntegers<K extends string>(
  payload: unknown,
  keys: readonly K[],
): Partial<Record<K, number>> {
  if (typeof payload !== "object" || payload === null) {
    return {};
  }

  const source = payload as Record<string, unknown>;
  const picked: Partial<Record<K, number>> = {};

  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isInteger(value) && value > 0) {
      picked[key] = value;
    }
  }

  return picked;
}

/**
 * Desce um nível no corpo recebido.
 *
 * `POST /platform/companies` leva o primeiro ADMIN aninhado em `admin`, e
 * `pickStrings` é plano — sem isto, a seção de administrador do formulário
 * chegaria vazia e a API responderia `admin must be a non-empty object`.
 */
export function pickNested(payload: unknown, key: string): unknown {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  return (payload as Record<string, unknown>)[key] ?? null;
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}

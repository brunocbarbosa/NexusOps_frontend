/**
 * Tipos do domínio `identity`, espelhando o contrato medido do backend
 * (`documents/backend/USERS.md`, Part I).
 */

import type { Page } from "@/lib/api/page";

/**
 * Os papéis que alguma rota aceita **atribuir** — e o que alimenta todo
 * `<Select>` de papel, nos dois consoles.
 *
 * `ADMIN_MASTER` não está aqui de propósito: nenhuma rota da API o aceita, e
 * pedir por ele é 400. O backend mantém a mesma lista em
 * `src/users/assignable-role.ts`, com um índice único parcial no PostgreSQL
 * atrás dela — o papel pertence à plataforma, então um ADMIN de company que
 * pudesse concedê-lo seria uma escalada para fora do próprio tenant.
 */
export const ASSIGNABLE_ROLES = ["ADMIN", "AGENT", "REQUESTER"] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/**
 * Todos os papéis que a interface precisa saber **exibir**: o badge, o filtro
 * do menu, a guarda de tela. Atribuir é outra pergunta — veja acima.
 *
 * Eles **não são hierárquicos**. O `RolesGuard` do backend checa pertinência
 * numa lista, nunca uma ordenação, então "mais alto" nunca implica acesso:
 * `ADMIN_MASTER` toma 403 em `/users` e chega aos usuários de uma company por
 * `/platform/companies/:id/users`.
 */
export const ROLES = ["ADMIN_MASTER", ...ASSIGNABLE_ROLES] as const;

export type Role = (typeof ROLES)[number];

/**
 * `UserResponse` — o que toda rota que devolve um usuário devolve.
 *
 * `role` é `AssignableRole` e não `Role`: nenhuma listagem devolve o operador,
 * porque ele não é staff de company nenhuma.
 */
export interface User {
  id: string;
  email: string;
  role: AssignableRole;
  createdAt: string;
  /** Soft delete: `null` significa ativo. */
  deletedAt: string | null;
}

/**
 * O `user` que `POST /auth/login` devolve.
 *
 * Tem a forma de `UserResponse`, mas o `role` é `Role`: o operador entra pela
 * mesma rota que todo mundo, com o domínio reservado `platform`, e o payload
 * capturado em `documents/backend/PLATFORM.md` mostra `"role":"ADMIN_MASTER"`
 * no corpo do login. É daqui que sai o destino pós-login — nem o `proxy.ts`
 * nem um Server Component poderiam descobrir o papel sozinhos.
 */
export type AuthUser = Omit<User, "role"> & { role: Role };

/**
 * `GET /auth/me`. É a única forma que **não** é `UserResponse`: carrega
 * `tenantId` e omite as datas, porque é o que o token resolveu e não uma
 * projeção do banco.
 *
 * O papel daqui é o autoritativo. O do JWT não é: o backend relê a linha a
 * cada requisição, então um ADMIN rebaixado há trinta segundos já é AGENT
 * enquanto o access token ainda diz o contrário por até 15 minutos.
 */
export interface SessionUser {
  id: string;
  tenantId: string;
  email: string;
  /** `Role`, não `AssignableRole`: é por aqui que o operador aparece. */
  role: Role;
}

export type UsersPage = Page<User>;

export interface UsersQuery {
  page: number;
  perPage: number;
  role?: AssignableRole;
  search?: string;
  includeDeleted: boolean;
}

export function isAssignableRole(value: unknown): value is AssignableRole {
  return (
    typeof value === "string" &&
    (ASSIGNABLE_ROLES as readonly string[]).includes(value)
  );
}

/**
 * Tipos do domínio `identity`, espelhando o contrato medido do backend
 * (`documents/backend/USERS.md`, Part I).
 */

export const USER_ROLES = ["ADMIN", "AGENT", "REQUESTER"] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** `UserResponse` — o que toda rota que devolve um usuário devolve. */
export interface User {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
  /** Soft delete: `null` significa ativo. */
  deletedAt: string | null;
}

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
  role: UserRole;
}

export interface PageMeta {
  total: number;
  page: number;
  perPage: number;
  /** Sempre >= 1, mesmo com `total: 0` — a UI renderiza "1 of 1" sem caso especial. */
  totalPages: number;
}

export interface UsersPage {
  data: User[];
  meta: PageMeta;
}

export interface UsersQuery {
  page: number;
  perPage: number;
  role?: UserRole;
  search?: string;
  includeDeleted: boolean;
}

export function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" && (USER_ROLES as readonly string[]).includes(value)
  );
}

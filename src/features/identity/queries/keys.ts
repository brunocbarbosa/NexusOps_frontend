import type { UsersQuery } from "../types";

/**
 * Chaves de cache do TanStack Query, num só lugar para que a invalidação
 * depois de uma mutação não dependa de alguém repetir o mesmo array à mão.
 */
export const identityKeys = {
  session: ["identity", "session"] as const,
  users: ["identity", "users"] as const,
  usersList: (query: UsersQuery) => ["identity", "users", "list", query] as const,
};

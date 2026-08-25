import type { CompaniesQuery } from "../types";

/**
 * Chaves de cache do console do operador.
 *
 * `companyUsers(id)` é a raiz que vira `queryKeyRoot` do `UsersScope` naquela
 * tela — é o que impede o cache de uma company de aparecer na outra.
 */
export const platformKeys = {
  companies: ["platform", "companies"] as const,
  companiesList: (query: CompaniesQuery) =>
    ["platform", "companies", "list", query] as const,
  company: (id: string) => ["platform", "companies", id] as const,
  companyUsers: (id: string) => ["platform", "companies", id, "users"] as const,
};

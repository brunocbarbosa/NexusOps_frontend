"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import { fetchJson, fetchVoid, jsonBody } from "@/lib/api/client";

import type { User, UserRole, UsersPage, UsersQuery } from "../types";
import { identityKeys } from "./keys";

export function usersSearchParams(query: UsersQuery): string {
  const params = new URLSearchParams({
    page: String(query.page),
    perPage: String(query.perPage),
  });

  if (query.role) {
    params.set("role", query.role);
  }
  if (query.search) {
    params.set("search", query.search);
  }
  if (query.includeDeleted) {
    // Flag booleana em query string é texto no backend: `'true'` explícito, e
    // ausência quando não se quer — `Boolean('false')` seria `true` lá.
    params.set("includeDeleted", "true");
  }

  return params.toString();
}

export function useUsers(query: UsersQuery) {
  return useQuery({
    queryKey: identityKeys.usersList(query),
    queryFn: () => fetchJson<UsersPage>(`/api/users?${usersSearchParams(query)}`),
    // Mantém a página anterior visível enquanto a próxima carrega, em vez de
    // piscar a tabela inteira a cada clique na paginação.
    placeholderData: keepPreviousData,
  });
}

export interface CreateUserInput {
  email: string;
  password: string;
  role: UserRole;
}

export function useCreateUser(): UseMutationResult<User, Error, CreateUserInput> {
  return useInvalidatingMutation((input: CreateUserInput) =>
    fetchJson<User>("/api/users", { method: "POST", ...jsonBody(input) }),
  );
}

export interface UpdateUserInput {
  id: string;
  email?: string;
  role?: UserRole;
}

export function useUpdateUser(): UseMutationResult<User, Error, UpdateUserInput> {
  return useInvalidatingMutation(({ id, ...changes }: UpdateUserInput) =>
    fetchJson<User>(`/api/users/${id}`, { method: "PATCH", ...jsonBody(changes) }),
  );
}

/**
 * Desativa — o backend não apaga. O registro sobrevive com `deletedAt`, o email
 * continua ocupado, e todas as sessões daquele usuário são encerradas.
 */
export function useDeactivateUser(): UseMutationResult<void, Error, string> {
  return useInvalidatingMutation((id: string) =>
    fetchVoid(`/api/users/${id}`, { method: "DELETE" }),
  );
}

export function useRestoreUser(): UseMutationResult<User, Error, string> {
  return useInvalidatingMutation((id: string) =>
    fetchJson<User>(`/api/users/${id}/restore`, { method: "POST" }),
  );
}

function useInvalidatingMutation<TData, TInput>(
  mutationFn: (input: TInput) => Promise<TData>,
): UseMutationResult<TData, Error, TInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: async () => {
      // Toda mutação muda a listagem: papel, status ou o total. Invalidar a
      // raiz da chave alcança todas as combinações de filtro em cache.
      await queryClient.invalidateQueries({ queryKey: identityKeys.users });
    },
  });
}

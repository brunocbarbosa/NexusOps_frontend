"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import { fetchJson, fetchVoid, jsonBody } from "@/lib/api/client";

import type { AssignableRole, User, UsersPage, UsersQuery } from "../types";
import { useUsersScope } from "../users-scope";

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
  const scope = useUsersScope();

  return useQuery({
    queryKey: [...scope.queryKeyRoot, "list", query],
    queryFn: () =>
      fetchJson<UsersPage>(`${scope.basePath}?${usersSearchParams(query)}`),
    // Mantém a página anterior visível enquanto a próxima carrega, em vez de
    // piscar a tabela inteira a cada clique na paginação.
    placeholderData: keepPreviousData,
  });
}

export interface CreateUserInput {
  email: string;
  password: string;
  role: AssignableRole;
}

export function useCreateUser(): UseMutationResult<User, Error, CreateUserInput> {
  const { basePath } = useUsersScope();

  return useInvalidatingMutation((input: CreateUserInput) =>
    fetchJson<User>(basePath, { method: "POST", ...jsonBody(input) }),
  );
}

export interface UpdateUserInput {
  id: string;
  email?: string;
  role?: AssignableRole;
}

export function useUpdateUser(): UseMutationResult<User, Error, UpdateUserInput> {
  const { basePath } = useUsersScope();

  return useInvalidatingMutation(({ id, ...changes }: UpdateUserInput) =>
    fetchJson<User>(`${basePath}/${id}`, { method: "PATCH", ...jsonBody(changes) }),
  );
}

/**
 * Desativa — o backend não apaga. O registro sobrevive com `deletedAt`, o email
 * continua ocupado, e todas as sessões daquele usuário são encerradas.
 */
export function useDeactivateUser(): UseMutationResult<void, Error, string> {
  const { basePath } = useUsersScope();

  return useInvalidatingMutation((id: string) =>
    fetchVoid(`${basePath}/${id}`, { method: "DELETE" }),
  );
}

export function useRestoreUser(): UseMutationResult<User, Error, string> {
  const { basePath } = useUsersScope();

  return useInvalidatingMutation((id: string) =>
    fetchJson<User>(`${basePath}/${id}/restore`, { method: "POST" }),
  );
}

function useInvalidatingMutation<TData, TInput>(
  mutationFn: (input: TInput) => Promise<TData>,
): UseMutationResult<TData, Error, TInput> {
  const queryClient = useQueryClient();
  const { queryKeyRoot } = useUsersScope();

  return useMutation({
    mutationFn,
    onSuccess: async () => {
      // Toda mutação muda a listagem: papel, status ou o total. Invalidar a
      // raiz da chave alcança todas as combinações de filtro em cache — e só
      // as da company que está aberta, porque a raiz vem do escopo.
      await queryClient.invalidateQueries({ queryKey: queryKeyRoot });
    },
  });
}

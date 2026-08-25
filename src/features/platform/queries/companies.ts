"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import { fetchJson, fetchVoid, jsonBody } from "@/lib/api/client";

import type {
  CompaniesPage,
  CompaniesQuery,
  Company,
  CreateCompanyInput,
  CreateCompanyResult,
  UpdateCompanyInput,
} from "../types";
import { platformKeys } from "./keys";

const BASE = "/api/platform/companies";

export function companiesSearchParams(query: CompaniesQuery): string {
  const params = new URLSearchParams({
    page: String(query.page),
    perPage: String(query.perPage),
  });

  if (query.search) {
    params.set("search", query.search);
  }
  if (query.isActive !== undefined) {
    // Booleano em query string é texto lá. E `undefined` é o jeito de pedir as
    // duas: mandar `''` ou `'all'` seria 400.
    params.set("isActive", String(query.isActive));
  }

  return params.toString();
}

export function useCompanies(query: CompaniesQuery) {
  return useQuery({
    queryKey: platformKeys.companiesList(query),
    queryFn: () =>
      fetchJson<CompaniesPage>(`${BASE}?${companiesSearchParams(query)}`),
    placeholderData: keepPreviousData,
  });
}

/** Uma company — o cabeçalho da tela de usuários dela. */
export function useCompany(id: string) {
  return useQuery({
    queryKey: platformKeys.company(id),
    queryFn: () => fetchJson<Company>(`${BASE}/${id}`),
  });
}

export function useCreateCompany(): UseMutationResult<
  CreateCompanyResult,
  Error,
  CreateCompanyInput
> {
  return useInvalidatingMutation((input: CreateCompanyInput) =>
    fetchJson<CreateCompanyResult>(BASE, { method: "POST", ...jsonBody(input) }),
  );
}

/** Renomear, trocar de domínio e **bloquear** — tudo `PATCH`. */
export function useUpdateCompany(): UseMutationResult<
  Company,
  Error,
  UpdateCompanyInput
> {
  return useInvalidatingMutation(({ id, ...changes }: UpdateCompanyInput) =>
    fetchJson<Company>(`${BASE}/${id}`, { method: "PATCH", ...jsonBody(changes) }),
  );
}

/**
 * Apaga de verdade: company, usuários, chamados, comentários e auditoria, por
 * cascade no banco. Sem restore, sem undo. Quem quer desfazer depois quer o
 * `useUpdateCompany({ isActive: false })`.
 */
export function useDeleteCompany(): UseMutationResult<void, Error, string> {
  return useInvalidatingMutation((id: string) =>
    fetchVoid(`${BASE}/${id}`, { method: "DELETE" }),
  );
}

function useInvalidatingMutation<TData, TInput>(
  mutationFn: (input: TInput) => Promise<TData>,
): UseMutationResult<TData, Error, TInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: platformKeys.companies });
    },
  });
}

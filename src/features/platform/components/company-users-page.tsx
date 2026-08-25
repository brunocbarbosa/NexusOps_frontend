"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/errors";

import { UsersScreen } from "../../identity/components/users-screen";
import { UsersScopeProvider } from "../../identity/users-scope";
import { useCompany } from "../queries/companies";
import { platformKeys } from "../queries/keys";

/**
 * `/platform/companies/:id/users` — os usuários de uma company, pelos olhos do
 * operador.
 *
 * A tela é a mesma de `/users`; o que muda vai no escopo. O operador gerencia e
 * vê desativados **sempre**: ele não é ADMIN de company nenhuma, e restaurar um
 * usuário exige achá-lo primeiro.
 */
export function CompanyUsersPage({ companyId }: { companyId: string }) {
  const company = useCompany(companyId);

  const scope = useMemo(
    () => ({
      basePath: `/api/platform/companies/${companyId}/users`,
      queryKeyRoot: platformKeys.companyUsers(companyId),
      canManage: true,
      canIncludeDeleted: true,
    }),
    [companyId],
  );

  if (company.error instanceof ApiError) {
    if (company.error.status === 403) {
      return (
        <EmptyState
          title="You don't have access to this page"
          description="Managing a company's users belongs to the platform operator."
        />
      );
    }

    // 404 é "não existe", e nada mais. O backend responde 404 — e não 403 —
    // justamente para não confirmar que o id existe em algum lugar, e a tela
    // não pode desfazer isso dizendo "existe, mas não para você".
    return (
      <EmptyState
        title="Company not found"
        description="This company does not exist. It may have been deleted."
      />
    );
  }

  return (
    <UsersScopeProvider scope={scope}>
      <UsersScreen
        header={
          <div className="flex items-center gap-2 text-sm">
            <Link
              href="/platform/companies"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <ArrowLeftIcon className="size-3.5" aria-hidden />
              Companies
            </Link>
            <span className="text-muted-foreground">/</span>
            {company.data ? (
              <span className="font-medium">{company.data.name}</span>
            ) : (
              <Skeleton className="h-4 w-32" />
            )}
          </div>
        }
        title="Users"
        description={
          company.data
            ? `Everyone who can sign in with ${company.data.domain ?? company.data.name}.`
            : "Everyone who can sign in to this company."
        }
        noAccess={{
          title: "You don't have access to this page",
          description:
            "Managing a company's users belongs to the platform operator.",
        }}
      />
    </UsersScopeProvider>
  );
}

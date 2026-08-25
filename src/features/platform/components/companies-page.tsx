"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/errors";

import { useCompanies } from "../queries/companies";
import type { CompaniesQuery, Company } from "../types";
import { CompaniesTable, type CompanyActions } from "./companies-table";
import { CompaniesToolbar } from "./companies-toolbar";
import { CompanyBlockDialog } from "./company-block-dialog";
import { CompanyDeleteDialog } from "./company-delete-dialog";
import { CompanyFormDialog, type CompanyFormMode } from "./company-form-dialog";

const PER_PAGE = 20;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * `/platform/companies` — a tela inicial do operador.
 *
 * O 403 vira estado e não erro: os papéis não são hierárquicos, então um ADMIN
 * de company que chegue aqui não é um caso impossível, é alguém no lugar
 * errado. E o backend relê o papel a cada requisição, então isto pode acontecer
 * numa tela que estava funcionando.
 */
export function CompaniesPage() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState<CompaniesQuery>({
    page: 1,
    perPage: PER_PAGE,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery((current) =>
        current.search === (search || undefined)
          ? current
          : { ...current, search: search || undefined, page: 1 },
      );
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [search]);

  const companies = useCompanies(query);

  const [formMode, setFormMode] = useState<CompanyFormMode | null>(null);
  const [blocking, setBlocking] = useState<Company | null>(null);
  const [deleting, setDeleting] = useState<Company | null>(null);

  const actions: CompanyActions = useMemo(
    () => ({
      onEdit: (company) => {
        setFormMode({ type: "edit", company });
      },
      onToggleActive: setBlocking,
      onDelete: setDeleting,
    }),
    [],
  );

  const setFilter = useCallback((changes: Partial<CompaniesQuery>) => {
    setQuery((current) => ({ ...current, ...changes, page: 1 }));
  }, []);

  if (companies.error instanceof ApiError && companies.error.status === 403) {
    return (
      <EmptyState
        title="You don't have access to this page"
        description="Managing companies belongs to the platform operator. Your own company's users are under Users."
      />
    );
  }

  const meta = companies.data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="grid max-w-5xl gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
        <p className="text-muted-foreground text-sm">
          Every company on this installation. Uncheck Active to lock one out
          without deleting anything.
        </p>
      </header>

      <CompaniesToolbar
        search={search}
        onSearchChange={setSearch}
        isActive={query.isActive}
        onIsActiveChange={(isActive) => setFilter({ isActive })}
        onCreate={() => {
          setFormMode({ type: "create" });
        }}
      />

      {companies.error &&
      !(companies.error instanceof ApiError && companies.error.status === 403) ? (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {companies.error instanceof ApiError
            ? companies.error.message
            : "Could not load companies."}
        </p>
      ) : null}

      {companies.isPending ? (
        <TableSkeleton />
      ) : (
        <CompaniesTable
          companies={companies.data?.data}
          actions={actions}
          isLoading={companies.isFetching}
        />
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {meta ? `${meta.total} compan${meta.total === 1 ? "y" : "ies"} · ` : null}
          Page {meta?.page ?? 1} of {totalPages}
        </p>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={(meta?.page ?? 1) <= 1 || companies.isFetching}
            onClick={() => {
              setQuery((current) => ({ ...current, page: current.page - 1 }));
            }}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={(meta?.page ?? 1) >= totalPages || companies.isFetching}
            onClick={() => {
              setQuery((current) => ({ ...current, page: current.page + 1 }));
            }}
          >
            Next
          </Button>
        </div>
      </footer>

      <CompanyFormDialog
        mode={formMode}
        onClose={() => {
          setFormMode(null);
        }}
      />
      <CompanyBlockDialog
        company={blocking}
        onClose={() => {
          setBlocking(null);
        }}
      />
      <CompanyDeleteDialog
        company={deleting}
        onClose={() => {
          setDeleting(null);
        }}
        onBlockInstead={setBlocking}
      />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="grid gap-2 rounded-lg border p-4">
      {[0, 1, 2, 3, 4].map((row) => (
        <Skeleton key={row} className="h-10 w-full" />
      ))}
    </div>
  );
}

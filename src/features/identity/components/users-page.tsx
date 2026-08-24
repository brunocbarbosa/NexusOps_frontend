"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/errors";

import { useSession } from "../queries/session";
import { useUsers } from "../queries/users";
import type { User, UserRole, UsersQuery } from "../types";
import { UserConfirmDialog, type ConfirmAction } from "./user-confirm-dialog";
import { UserFormDialog, type UserFormMode } from "./user-form-dialog";
import { UsersTable } from "./users-table";
import { UsersToolbar } from "./users-toolbar";

const PER_PAGE = 20;
const SEARCH_DEBOUNCE_MS = 300;

export function UsersPage() {
  const { data: session } = useSession();
  const isAdmin = session?.role === "ADMIN";

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState<UsersQuery>({
    page: 1,
    perPage: PER_PAGE,
    includeDeleted: false,
  });

  // Uma requisição por tecla digitada seria uma por letra do email. O debounce
  // também volta para a primeira página: filtrar e continuar na página 4 quase
  // sempre mostra "nenhum resultado" por engano.
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

  const users = useUsers(query);

  const [formMode, setFormMode] = useState<UserFormMode | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const actions = useMemo(
    () => ({
      onEdit: (user: User) => {
        setFormMode({ type: "edit", user });
      },
      onDeactivate: (user: User) => {
        setConfirmAction({ type: "deactivate", user });
      },
      onRestore: (user: User) => {
        setConfirmAction({ type: "restore", user });
      },
    }),
    [],
  );

  const setFilter = useCallback((changes: Partial<UsersQuery>) => {
    setQuery((current) => ({ ...current, ...changes, page: 1 }));
  }, []);

  if (users.error instanceof ApiError && users.error.status === 403) {
    return (
      <EmptyState
        title="You don't have access to this page"
        description="Listing users is available to administrators and agents. Ask an administrator of your company if you need it."
      />
    );
  }

  const meta = users.data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="grid max-w-5xl gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-muted-foreground text-sm">
          Everyone who can sign in to your company&apos;s NexusOps.
        </p>
      </header>

      <UsersToolbar
        search={search}
        onSearchChange={setSearch}
        role={query.role}
        onRoleChange={(role: UserRole | undefined) => setFilter({ role })}
        includeDeleted={query.includeDeleted}
        onIncludeDeletedChange={(includeDeleted) => setFilter({ includeDeleted })}
        isAdmin={Boolean(isAdmin)}
        onCreate={() => {
          setFormMode({ type: "create" });
        }}
      />

      {users.error && !(users.error instanceof ApiError && users.error.status === 403) ? (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {users.error instanceof ApiError
            ? users.error.message
            : "Could not load users."}
        </p>
      ) : null}

      {users.isPending ? (
        <TableSkeleton />
      ) : (
        <UsersTable
          users={users.data?.data}
          actions={actions}
          canManage={Boolean(isAdmin)}
          isLoading={users.isFetching}
        />
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {meta ? `${meta.total} user${meta.total === 1 ? "" : "s"} · ` : null}
          Page {meta?.page ?? 1} of {totalPages}
        </p>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={(meta?.page ?? 1) <= 1 || users.isFetching}
            onClick={() => {
              setQuery((current) => ({ ...current, page: current.page - 1 }));
            }}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={(meta?.page ?? 1) >= totalPages || users.isFetching}
            onClick={() => {
              setQuery((current) => ({ ...current, page: current.page + 1 }));
            }}
          >
            Next
          </Button>
        </div>
      </footer>

      <UserFormDialog
        mode={formMode}
        onClose={() => {
          setFormMode(null);
        }}
      />
      <UserConfirmDialog
        action={confirmAction}
        onClose={() => {
          setConfirmAction(null);
        }}
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

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="text-muted-foreground mt-2 text-sm">{description}</p>
    </div>
  );
}

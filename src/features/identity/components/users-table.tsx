"use client";

import { useMemo } from "react";
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { formatDate } from "../format";
import type { User } from "../types";
import { RoleBadge } from "./role-badge";
import { UserRowActions, type UserActions } from "./user-row-actions";

/**
 * A grid de usuários.
 *
 * Nenhuma feature do TanStack Table está ligada, e isso é a decisão certa
 * aqui: ordenação e paginação são do servidor — a API ordena por `createdAt` e
 * pagina com `page`/`perPage` —, então habilitar as versões de cliente faria a
 * tabela ordenar só as 20 linhas visíveis e mentir para quem olha.
 *
 * Também não é virtualizada: `perPage` tem teto de 100 no backend.
 * `@tanstack/react-virtual` é para a timeline de auditoria.
 */
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, User>();
const NO_ROWS: User[] = [];

export function UsersTable({
  users,
  actions,
  canManage,
  isLoading,
}: {
  users: User[] | undefined;
  actions: UserActions;
  canManage: boolean;
  isLoading: boolean;
}) {
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("email", {
          header: "Email",
          cell: (info) => (
            <span
              className={cn(
                "font-medium",
                info.row.original.deletedAt !== null && "text-muted-foreground",
              )}
            >
              {info.getValue()}
            </span>
          ),
        }),
        helper.accessor("role", {
          header: "Role",
          cell: (info) => <RoleBadge role={info.getValue()} />,
        }),
        helper.accessor("deletedAt", {
          header: "Status",
          cell: (info) =>
            info.getValue() === null ? (
              <Badge variant="outline" className="border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                Active
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Deactivated
              </Badge>
            ),
        }),
        helper.accessor("createdAt", {
          header: "Created",
          cell: (info) => (
            <span className="text-muted-foreground tabular-nums">
              {formatDate(info.getValue())}
            </span>
          ),
        }),
        helper.display({
          id: "actions",
          header: "",
          cell: (info) =>
            canManage ? (
              <div className="flex justify-end">
                <UserRowActions user={info.row.original} actions={actions} />
              </div>
            ) : null,
        }),
      ]),
    [actions, canManage],
  );

  const table = useTable({ features, columns, data: users ?? NO_ROWS });

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="hover:bg-transparent">
              {group.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id}>
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))}

          {table.getRowModel().rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="h-28 text-center">
                <span className="text-muted-foreground text-sm">
                  {isLoading ? "Loading users…" : "No users match these filters."}
                </span>
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}

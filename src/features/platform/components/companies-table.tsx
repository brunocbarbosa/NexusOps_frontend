"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { MoreHorizontalIcon, PencilIcon, Trash2Icon, UsersIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatDate } from "../../identity/format";
import type { Company } from "../types";

export interface CompanyActions {
  onEdit: (company: Company) => void;
  onToggleActive: (company: Company) => void;
  onDelete: (company: Company) => void;
}

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, Company>();
const NO_ROWS: Company[] = [];

export function CompaniesTable({
  companies,
  actions,
  isLoading,
}: {
  companies: Company[] | undefined;
  actions: CompanyActions;
  isLoading: boolean;
}) {
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("name", {
          header: "Company",
          cell: (info) => (
            <span className="font-medium">{info.getValue()}</span>
          ),
        }),
        helper.accessor("domain", {
          header: "Domain",
          cell: (info) => (
            <span className="text-muted-foreground font-mono text-xs">
              {/* O backend permite company sem domínio. */}
              {info.getValue() ?? "—"}
            </span>
          ),
        }),
        helper.accessor("isActive", {
          header: "Active",
          cell: (info) => (
            <ActiveCheckbox company={info.row.original} actions={actions} />
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
          cell: (info) => (
            <div className="flex justify-end">
              <RowActions company={info.row.original} actions={actions} />
            </div>
          ),
        }),
      ]),
    [actions],
  );

  const table = useTable({ features, columns, data: companies ?? NO_ROWS });

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
                  {isLoading
                    ? "Loading companies…"
                    : "No companies match these filters."}
                </span>
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * A caixinha que bloqueia.
 *
 * Marcada, a company está ativa e o pessoal dela entra; desmarcada, ninguém
 * entra. Ela **não** muta no clique: abre a confirmação, porque tirar uma
 * empresa inteira de dentro do sistema merece uma frase antes — e porque
 * `checked` continua refletindo o servidor, não o clique, até a resposta voltar.
 */
function ActiveCheckbox({
  company,
  actions,
}: {
  company: Company;
  actions: CompanyActions;
}) {
  return (
    <Checkbox
      checked={company.isActive}
      onCheckedChange={() => actions.onToggleActive(company)}
      aria-label={`${company.name} is active`}
    />
  );
}

function RowActions({
  company,
  actions,
}: {
  company: Company;
  actions: CompanyActions;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Actions for ${company.name}`}
        >
          <MoreHorizontalIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/platform/companies/${company.id}/users`}>
            <UsersIcon aria-hidden />
            Manage users
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.onEdit(company)}>
          <PencilIcon aria-hidden />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* Longe da caixinha de bloquear, de propósito: um é reversível e o
            outro não tem volta. */}
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => actions.onDelete(company)}
        >
          <Trash2Icon aria-hidden />
          Delete permanently
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

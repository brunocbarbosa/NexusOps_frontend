"use client";

import { PlusIcon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { categoryLabel, priorityLabel, statusLabel } from "../format";
import { useStaff } from "../queries/staff";
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  UNASSIGNED,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
  type TicketsQuery,
} from "../types";

/**
 * `<Select>` do Radix não aceita `value=""` — string vazia é como ele diz
 * "nada selecionado". Um sentinela nomeado é o que permite a opção "qualquer".
 */
const ANY = "ANY";

export function TicketsToolbar({
  search,
  onSearchChange,
  query,
  onFilterChange,
  canFilterByAssignee,
  onCreate,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  query: TicketsQuery;
  onFilterChange: (changes: Partial<TicketsQuery>) => void;
  /** Só staff: para um REQUESTER o backend já devolve apenas os chamados dele. */
  canFilterByAssignee: boolean;
  onCreate: () => void;
}) {
  const staff = useStaff(canFilterByAssignee);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-56 flex-1">
        <SearchIcon
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search tickets"
          aria-label="Search tickets by title or description"
          className="pl-9"
        />
      </div>

      <Select
        value={query.status ?? ANY}
        onValueChange={(value) =>
          onFilterChange({
            status: value === ANY ? undefined : (value as TicketStatus),
          })
        }
      >
        <SelectTrigger className="w-36" aria-label="Filter by status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any status</SelectItem>
          {TICKET_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {statusLabel(status)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={query.priority ?? ANY}
        onValueChange={(value) =>
          onFilterChange({
            priority: value === ANY ? undefined : (value as TicketPriority),
          })
        }
      >
        <SelectTrigger className="w-36" aria-label="Filter by priority">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any priority</SelectItem>
          {TICKET_PRIORITIES.map((priority) => (
            <SelectItem key={priority} value={priority}>
              {priorityLabel(priority)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={query.category ?? ANY}
        onValueChange={(value) =>
          onFilterChange({
            category: value === ANY ? undefined : (value as TicketCategory),
          })
        }
      >
        <SelectTrigger className="w-36" aria-label="Filter by category">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any category</SelectItem>
          {TICKET_CATEGORIES.map((category) => (
            <SelectItem key={category} value={category}>
              {categoryLabel(category)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Um campo só para responsável: `unassigned` e `assigneeId` se
          contradizem no backend (400), e dois controles independentes
          convidariam a exatamente aquela requisição. */}
      {canFilterByAssignee ? (
        <Select
          value={query.assignee ?? ANY}
          onValueChange={(value) =>
            onFilterChange({ assignee: value === ANY ? undefined : value })
          }
        >
          <SelectTrigger className="w-44" aria-label="Filter by assignee">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Anyone</SelectItem>
            <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
            {(staff.data ?? []).map((person) => (
              <SelectItem key={person.id} value={person.id}>
                {person.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {/* Aberto por qualquer papel: o requester é sempre quem chama, então não
          há como abrir em nome de outra pessoa e não há guarda a aplicar. */}
      <Button onClick={onCreate}>
        <PlusIcon aria-hidden />
        New ticket
      </Button>
    </div>
  );
}

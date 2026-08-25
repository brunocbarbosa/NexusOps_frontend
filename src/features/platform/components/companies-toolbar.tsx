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

const ANY = "ANY";

export function CompaniesToolbar({
  search,
  onSearchChange,
  isActive,
  onIsActiveChange,
  onCreate,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  isActive: boolean | undefined;
  onIsActiveChange: (value: boolean | undefined) => void;
  onCreate: () => void;
}) {
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
          placeholder="Search by name or domain"
          aria-label="Search companies by name or domain"
          className="pl-9"
        />
      </div>

      <Select
        value={isActive === undefined ? ANY : String(isActive)}
        onValueChange={(value) =>
          // `undefined` é como se pede "as duas": não existe valor para isso na
          // API, a ausência do parâmetro é que significa ambas.
          onIsActiveChange(value === ANY ? undefined : value === "true")
        }
      >
        <SelectTrigger className="w-40" aria-label="Filter by status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any status</SelectItem>
          <SelectItem value="true">Active</SelectItem>
          <SelectItem value="false">Blocked</SelectItem>
        </SelectContent>
      </Select>

      <Button onClick={onCreate}>
        <PlusIcon aria-hidden />
        New company
      </Button>
    </div>
  );
}

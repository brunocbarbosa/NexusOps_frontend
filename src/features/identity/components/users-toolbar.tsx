"use client";

import { PlusIcon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { USER_ROLES, type UserRole } from "../types";

const ANY_ROLE = "ANY";

export function UsersToolbar({
  search,
  onSearchChange,
  role,
  onRoleChange,
  includeDeleted,
  onIncludeDeletedChange,
  isAdmin,
  onCreate,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  role: UserRole | undefined;
  onRoleChange: (value: UserRole | undefined) => void;
  includeDeleted: boolean;
  onIncludeDeletedChange: (value: boolean) => void;
  isAdmin: boolean;
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
          placeholder="Search by email"
          aria-label="Search users by email"
          className="pl-9"
        />
      </div>

      <Select
        value={role ?? ANY_ROLE}
        onValueChange={(value) =>
          onRoleChange(value === ANY_ROLE ? undefined : (value as UserRole))
        }
      >
        <SelectTrigger className="w-40" aria-label="Filter by role">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY_ROLE}>Any role</SelectItem>
          {USER_ROLES.map((option) => (
            <SelectItem key={option} value={option}>
              {option.charAt(0) + option.slice(1).toLowerCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Só ADMIN: para os demais o backend responde 403 em vez de fingir que
          não há desativados — e um controle que sempre falha é pior que nenhum. */}
      {isAdmin ? (
        <div className="flex items-center gap-2">
          <Switch
            id="include-deleted"
            checked={includeDeleted}
            onCheckedChange={onIncludeDeletedChange}
          />
          <Label htmlFor="include-deleted" className="text-muted-foreground text-sm">
            Show deactivated
          </Label>
        </div>
      ) : null}

      {isAdmin ? (
        <Button onClick={onCreate}>
          <PlusIcon aria-hidden />
          New user
        </Button>
      ) : null}
    </div>
  );
}

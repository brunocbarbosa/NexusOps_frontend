"use client";

import { MoreHorizontalIcon, PencilIcon, RotateCcwIcon, UserXIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { User } from "../types";

export interface UserActions {
  onEdit: (user: User) => void;
  onDeactivate: (user: User) => void;
  onRestore: (user: User) => void;
}

export function UserRowActions({
  user,
  actions,
}: {
  user: User;
  actions: UserActions;
}) {
  const deactivated = user.deletedAt !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Actions for ${user.email}`}
        >
          <MoreHorizontalIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {deactivated ? (
          // Restaurar traz a mesma linha de volta, com o histórico preso a ela
          // — o que um cadastro novo não faria.
          <DropdownMenuItem onClick={() => actions.onRestore(user)}>
            <RotateCcwIcon aria-hidden />
            Restore
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem onClick={() => actions.onEdit(user)}>
              <PencilIcon aria-hidden />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => actions.onDeactivate(user)}
            >
              <UserXIcon aria-hidden />
              Deactivate
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

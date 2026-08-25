"use client";

import Link from "next/link";
import { KeyRoundIcon, LogOutIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useLogout } from "../queries/session";
import type { SessionUser } from "../types";
import { RoleBadge } from "./role-badge";

export function UserMenu({ user }: { user: SessionUser }) {
  const logout = useLogout();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* O rótulo é fixo porque o email some do nome acessível em telas
            estreitas, onde ele fica escondido por CSS. */}
        <Button variant="ghost" className="gap-2 px-2" aria-label="Account menu">
          <span
            aria-hidden
            className="bg-muted text-muted-foreground flex size-7 items-center justify-center rounded-full text-xs font-medium uppercase"
          >
            {user.email.slice(0, 2)}
          </span>
          <span className="hidden max-w-[14ch] truncate text-sm sm:inline">
            {user.email}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="grid gap-1.5">
          <span className="truncate text-sm font-medium">{user.email}</span>
          <RoleBadge role={user.role} />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">
            <KeyRoundIcon aria-hidden />
            Change password
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            logout.mutate();
          }}
          disabled={logout.isPending}
        >
          <LogOutIcon aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

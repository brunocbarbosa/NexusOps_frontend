"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2Icon,
  KeyRoundIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

import { BrandWordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

import { useSession } from "../queries/session";
import type { Role, SessionUser } from "../types";
import { UserMenu } from "./user-menu";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** `undefined` significa qualquer papel autenticado. */
  roles?: readonly Role[];
}

const NAV: readonly NavItem[] = [
  // O console do operador. Os papéis não são hierárquicos: quem não é
  // ADMIN_MASTER recebe 403 em todo `/platform/**`.
  {
    href: "/platform/companies",
    label: "Companies",
    icon: Building2Icon,
    roles: ["ADMIN_MASTER"],
  },
  // Listar usuários é ADMIN ou AGENT; um REQUESTER receberia 403, então o item
  // nem aparece para ele. O operador também não entra aqui — ele chega aos
  // usuários de uma company por `/platform/companies/:id/users`.
  { href: "/users", label: "Users", icon: UsersIcon, roles: ["ADMIN", "AGENT"] },
  // Escondido do operador: `PlatformBootstrapService` reconcilia o email e a
  // senha dele a partir do `.env` do backend a cada boot, então uma troca feita
  // pela API seria revertida no próximo restart.
  {
    href: "/account",
    label: "Account",
    icon: KeyRoundIcon,
    roles: ["ADMIN", "AGENT", "REQUESTER"],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: user, error } = useSession();

  const sessionExpired = error instanceof ApiError && error.status === 401;

  useEffect(() => {
    if (sessionExpired) {
      router.replace("/login");
    }
  }, [sessionExpired, router]);

  return (
    <div className="bg-background min-h-screen md:grid md:grid-cols-[15rem_1fr]">
      <aside className="bg-sidebar hidden border-r md:flex md:flex-col">
        <div className="flex h-14 items-center border-b px-5">
          <BrandWordmark />
        </div>
        <nav className="grid gap-1 p-3">
          <NavLinks user={user} />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="bg-background/80 sticky top-0 z-10 flex h-14 items-center gap-2 border-b px-4 backdrop-blur md:px-6">
          <div className="md:hidden">
            <BrandWordmark className="text-sm" />
          </div>
          <div className="flex-1" />
          <ThemeToggle />
          {user ? <UserMenu user={user} /> : <Skeleton className="h-8 w-32" />}
        </header>

        <nav className="flex gap-1 border-b px-4 py-2 md:hidden">
          <NavLinks user={user} />
        </nav>

        <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

function NavLinks({ user }: { user: SessionUser | undefined }) {
  const pathname = usePathname();

  return (
    <>
      {NAV.filter((item) => !item.roles || (user && item.roles.includes(user.role))).map(
        (item) => {
          // Por prefixo, não por igualdade: `/platform/companies/:id/users` é
          // a mesma seção que `/platform/companies`. O `/` no fim evita que
          // `/users` case com `/users-outra-coisa`.
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <item.icon className="size-4" aria-hidden />
              {item.label}
            </Link>
          );
        },
      )}
    </>
  );
}

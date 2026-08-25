"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/errors";

import { landingPath } from "../next-path";
import { useSession } from "../queries/session";

/**
 * O despachante da raiz.
 *
 * Existem dois consoles e nenhum dos dois lugares que poderiam decidir sabe o
 * papel: o `proxy.ts` só enxerga a presença do cookie, e um Server Component
 * não pode buscar dado autenticado — gastaria o refresh token sem conseguir
 * persistir o par rotacionado, e o token velho reapresentado revoga a família
 * inteira. Então quem decide é o cliente, com o `/auth/me` que a UI já usa como
 * fonte de papel.
 *
 * É o **único** despachante: o login manda para cá, o proxy manda para cá, e o
 * `safeNextPath` cai para cá.
 */
export function SessionLanding() {
  const router = useRouter();
  const { data: user, error } = useSession();

  const expired = error instanceof ApiError && error.status === 401;

  useEffect(() => {
    if (expired) {
      router.replace("/login");
      return;
    }

    if (user) {
      router.replace(landingPath(user.role, null));
    }
  }, [user, expired, router]);

  return (
    <div className="grid min-h-screen place-items-center p-8">
      <div className="grid w-full max-w-sm gap-3" aria-busy>
        <span className="sr-only">Signing you in…</span>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

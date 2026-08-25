"use client";

import { useMemo } from "react";

import { identityKeys } from "../queries/keys";
import { useSession } from "../queries/session";
import { UsersScopeProvider } from "../users-scope";
import { UsersScreen } from "./users-screen";

/**
 * `/users` — os usuários da própria company de quem entrou.
 *
 * A tela mora em `UsersScreen`, compartilhada com o console do operador. O que
 * esta casca faz é dizer de onde vem o dado e o que este visitante pode: aqui
 * gerenciar e ver desativados são a mesma pergunta ("é ADMIN?"), o que no outro
 * console não é.
 */
export function UsersPage() {
  const { data: session } = useSession();
  const isAdmin = session?.role === "ADMIN";

  // Memoizado porque é valor de contexto: um objeto novo a cada render
  // re-renderiza todo consumidor, e são eles que seguram a tabela.
  const scope = useMemo(
    () => ({
      basePath: "/api/users",
      queryKeyRoot: identityKeys.users,
      canManage: isAdmin,
      canIncludeDeleted: isAdmin,
    }),
    [isAdmin],
  );

  return (
    <UsersScopeProvider scope={scope}>
      <UsersScreen
        title="Users"
        description="Everyone who can sign in to your company's NexusOps."
        noAccess={{
          title: "You don't have access to this page",
          description:
            "Listing users is available to administrators and agents. Ask an administrator of your company if you need it.",
        }}
      />
    </UsersScopeProvider>
  );
}

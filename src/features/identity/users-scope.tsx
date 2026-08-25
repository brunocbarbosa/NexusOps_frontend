"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * De onde vem a lista de usuários, e o que quem está olhando pode fazer com
 * ela.
 *
 * A mesma tela serve os dois consoles. `/users` mostra os usuários da própria
 * company de quem entrou; `/platform/companies/:id/users` mostra os de uma
 * company escolhida pelo operador. Os payloads, os 409 e o diálogo que oferece
 * restaurar são idênticos — o que muda é isto aqui.
 *
 * O escopo é lido pelos **próprios hooks** de `queries/users.ts`, não passado
 * por props. Assim as assinaturas de `useUsers()`, `useCreateUser()` e irmãos
 * não mudam, e os quatro componentes que os consomem — inclusive os diálogos,
 * que os chamam lá de dentro — seguem sem saber que existem dois consoles.
 */
export interface UsersScope {
  /** Base no BFF: `/api/users` ou `/api/platform/companies/<id>/users`. */
  basePath: string;
  /**
   * Raiz da chave de cache.
   *
   * Está aqui em vez de derivada do `basePath` porque é o que separa uma
   * company da outra: sem ela na chave, abrir a company A e depois a B mostra
   * os usuários de A até a primeira revalidação.
   */
  queryKeyRoot: readonly unknown[];
  /** Criar, editar, desativar e restaurar. */
  canManage: boolean;
  /**
   * Pedir `includeDeleted=true`.
   *
   * Separado de `canManage` porque no console da empresa os dois coincidem
   * (ambos são "é ADMIN") e no do operador não têm relação nenhuma — um AGENT
   * que pedisse recebe 403, não a lista filtrada, então o controle precisa
   * sumir em vez de falhar.
   */
  canIncludeDeleted: boolean;
}

const UsersScopeContext = createContext<UsersScope | null>(null);

export function UsersScopeProvider({
  scope,
  children,
}: {
  scope: UsersScope;
  children: ReactNode;
}) {
  return (
    <UsersScopeContext value={scope}>{children}</UsersScopeContext>
  );
}

export function useUsersScope(): UsersScope {
  const scope = useContext(UsersScopeContext);

  if (!scope) {
    // Sem provider, os hooks montariam requisições para `undefined/...` e a
    // falha apareceria como um 404 confuso em tempo de execução.
    throw new Error("useUsersScope precisa de um <UsersScopeProvider> acima.");
  }

  return scope;
}

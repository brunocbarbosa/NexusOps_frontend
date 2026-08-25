/**
 * Chaves de cache do TanStack Query, num só lugar para que a invalidação
 * depois de uma mutação não dependa de alguém repetir o mesmo array à mão.
 *
 * A chave de uma **lista** de usuários não está aqui: ela é montada a partir do
 * `queryKeyRoot` do `UsersScope`, porque a mesma tela serve `/users` e os
 * usuários de cada company e as três precisam de caches separados. `users`
 * abaixo é a raiz do console da empresa, e é o que aquele escopo carrega.
 */
export const identityKeys = {
  session: ["identity", "session"] as const,
  users: ["identity", "users"] as const,
};

"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/errors";

/**
 * Providers globais da aplicação.
 *
 * O QueryClient nasce dentro de `useState` de propósito. Criá-lo no escopo do
 * módulo faria uma única instância ser compartilhada entre requisições no
 * servidor — e com isso o cache de um tenant vazaria para outro. Multi-tenancy
 * aqui é premissa, não detalhe: ver `documents/backend/TENANCY_EXTENSION.md`.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          mutations: {
            // Mutação nunca repete sozinha: criar duas vezes o mesmo usuário,
            // ou desativar duas vezes, não é reintento, é outro efeito.
            retry: false,
          },
          queries: {
            // Sem isto, o cliente refaz no cliente tudo que o servidor já
            // buscou, logo após a hidratação.
            staleTime: 30_000,

            // Refetch a cada foco de janela é ruído numa ferramenta que o
            // analista deixa aberta o dia inteiro.
            refetchOnWindowFocus: false,

            // Repetir um erro do cliente não muda a resposta: um 404 (recurso
            // de outro tenant) segue 404, um 403 segue 403, e repetir um 409
            // sobrescreveria a alteração de outro analista. Só falha de rede
            // (status 0) e erro do servidor valem uma segunda tentativa.
            retry: (failureCount, error) =>
              failureCount < 1 &&
              !(error instanceof ApiError && error.status >= 400 && error.status < 500),
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

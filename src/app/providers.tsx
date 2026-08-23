"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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
          queries: {
            // Sem isto, o cliente refaz no cliente tudo que o servidor já
            // buscou, logo após a hidratação.
            staleTime: 30_000,

            // Refetch a cada foco de janela é ruído numa ferramenta que o
            // analista deixa aberta o dia inteiro.
            refetchOnWindowFocus: false,

            // Conservador de propósito. A política definitiva depende de
            // distinguir os erros do backend: 404 (recurso de outro tenant) e
            // 409 (conflito de versão) nunca devem ser repetidos — repetir um
            // 409 sobrescreveria a alteração de outro analista. Isso chega
            // junto com o cliente de API tipado, que dá forma ao erro.
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

import type { ReactElement, ReactNode } from "react";
import { render, type RenderResult } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Renderiza um componente com um QueryClient próprio, sem `retry` e sem cache
 * entre casos — um cliente compartilhado faria um teste enxergar o resultado do
 * anterior.
 */
export function renderWithQuery(ui: ReactElement): RenderResult {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper });
}

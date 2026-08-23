import { render, screen, waitFor } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import { Providers } from "./providers";

function ConsumidorDeQuery() {
  const { data } = useQuery({
    queryKey: ["scaffold-probe"],
    queryFn: () => Promise.resolve("query respondeu"),
  });

  return <span>{data ?? "carregando"}</span>;
}

/**
 * Montar o QueryClientProvider não prova que ele funciona — só que a árvore
 * renderizou. Este teste coloca um `useQuery` dentro dele: sem provider,
 * o hook lança.
 */
describe("Providers", () => {
  it("fornece um QueryClient utilizável pelos hooks do TanStack Query", async () => {
    render(
      <Providers>
        <ConsumidorDeQuery />
      </Providers>,
    );

    await waitFor(() => {
      expect(screen.getByText("query respondeu")).toBeInTheDocument();
    });
  });
});

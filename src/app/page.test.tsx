import { render, screen } from "@testing-library/react";
import Home from "./page";

/**
 * Teste de fumaça do scaffold.
 *
 * Existe para provar que a cadeia de teste funciona — transformação do
 * next/jest, alias `@/*`, jsdom e matchers do jest-dom. Não é um teste da
 * página: quando a home virar tela de produto, este arquivo vai junto.
 */
describe("scaffold", () => {
  it("renderiza a página inicial com o componente do design system", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: "NexusOps" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Componente shadcn" }),
    ).toBeInTheDocument();
  });
});

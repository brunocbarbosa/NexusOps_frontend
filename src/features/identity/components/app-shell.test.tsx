import { screen, waitFor } from "@testing-library/react";

import { jsonResponse } from "../../../test/http";
import { renderWithQuery } from "../../../test/query-wrapper";
import type { Role } from "../types";
import { AppShell } from "./app-shell";

const mockReplace = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), refresh: jest.fn() }),
  usePathname: () => "/users",
}));

const fetchMock = jest.fn();

beforeEach(() => {
  mockReplace.mockReset();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
});

function signedInAs(role: Role) {
  fetchMock.mockResolvedValue(
    jsonResponse({ id: "u1", tenantId: "t1", email: "admin@acme.com", role }),
  );
}

describe("AppShell", () => {
  it("mostra Users para quem pode listar", async () => {
    signedInAs("ADMIN");
    renderWithQuery(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );

    expect(await screen.findAllByRole("link", { name: "Users" })).not.toHaveLength(0);
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("esconde Users do REQUESTER, que receberia 403 na rota", async () => {
    signedInAs("REQUESTER");
    renderWithQuery(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );

    await screen.findAllByRole("link", { name: "Account" });
    expect(screen.queryByRole("link", { name: "Users" })).not.toBeInTheDocument();
  });

  it("mostra Companies só para o operador da plataforma", async () => {
    signedInAs("ADMIN_MASTER");
    renderWithQuery(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );

    expect(
      await screen.findAllByRole("link", { name: "Companies" }),
    ).not.toHaveLength(0);
    // Os papéis não são hierárquicos: o operador toma 403 em `/users`.
    expect(screen.queryByRole("link", { name: "Users" })).not.toBeInTheDocument();
  });

  it("esconde Companies de quem é de uma company", async () => {
    signedInAs("ADMIN");
    renderWithQuery(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );

    await screen.findAllByRole("link", { name: "Users" });
    expect(screen.queryByRole("link", { name: "Companies" })).not.toBeInTheDocument();
  });

  it("esconde Account do operador — a senha dele vem do .env do backend", async () => {
    // `PlatformBootstrapService` reconcilia email e senha a cada boot, então
    // uma troca feita pela API seria revertida no próximo restart.
    signedInAs("ADMIN_MASTER");
    renderWithQuery(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );

    await screen.findAllByRole("link", { name: "Companies" });
    expect(screen.queryByRole("link", { name: "Account" })).not.toBeInTheDocument();
  });

  it("manda para o login quando a sessão já não vale", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ message: "Unauthorized", statusCode: 401 }, 401),
    );

    renderWithQuery(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/login");
    });
  });
});

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

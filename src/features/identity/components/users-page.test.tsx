import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { jsonResponse } from "../../../test/http";
import { renderWithQuery } from "../../../test/query-wrapper";
import type { Role } from "../types";
import { UsersPage } from "./users-page";

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
});

const users = [
  {
    id: "u1",
    email: "admin@acme.com",
    role: "ADMIN" as const,
    createdAt: "2026-08-23T13:29:18.546Z",
    deletedAt: null,
  },
  {
    id: "u2",
    email: "agent@acme.com",
    role: "AGENT" as const,
    createdAt: "2026-08-23T14:00:00.000Z",
    deletedAt: "2026-08-24T10:00:00.000Z",
  },
];

/** Roteia por URL: a tela busca a sessão e a listagem ao mesmo tempo. */
function serve(options: {
  role?: Role;
  usersStatus?: number;
  total?: number;
  totalPages?: number;
}) {
  fetchMock.mockImplementation((url: string) => {
    if (url.startsWith("/api/auth/me")) {
      return Promise.resolve(
        jsonResponse({
          id: "u1",
          tenantId: "t1",
          email: "admin@acme.com",
          role: options.role ?? "ADMIN",
        }),
      );
    }

    if (options.usersStatus && options.usersStatus >= 400) {
      return Promise.resolve(
        jsonResponse(
          { message: "Forbidden resource", statusCode: options.usersStatus },
          options.usersStatus,
        ),
      );
    }

    return Promise.resolve(
      jsonResponse({
        data: users,
        meta: {
          total: options.total ?? 2,
          page: 1,
          perPage: 20,
          totalPages: options.totalPages ?? 1,
        },
      }),
    );
  });
}

function usersRequests(): string[] {
  return fetchMock.mock.calls
    .map(([url]) => String(url))
    .filter((url) => url.startsWith("/api/users"));
}

describe("UsersPage", () => {
  it("lista os usuários com papel e status", async () => {
    serve({});
    renderWithQuery(<UsersPage />);

    expect(await screen.findByText("admin@acme.com")).toBeInTheDocument();

    const deactivatedRow = screen.getByText("agent@acme.com").closest("tr");
    expect(within(deactivatedRow as HTMLElement).getByText("Deactivated")).toBeInTheDocument();
    expect(within(deactivatedRow as HTMLElement).getByText("Agent")).toBeInTheDocument();
  });

  it("explica o 403 em vez de mostrar erro cru — um REQUESTER não pode listar", async () => {
    serve({ role: "REQUESTER", usersStatus: 403 });
    renderWithQuery(<UsersPage />);

    expect(
      await screen.findByText("You don't have access to this page"),
    ).toBeInTheDocument();
  });

  it("esconde criar, desativados e ações de linha do AGENT, que receberia 403", async () => {
    serve({ role: "AGENT" });
    renderWithQuery(<UsersPage />);

    await screen.findByText("admin@acme.com");

    expect(screen.queryByRole("button", { name: /New user/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Show deactivated")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Actions for/ }),
    ).not.toBeInTheDocument();
  });

  it("pede includeDeleted=true só quando o ADMIN liga a chave", async () => {
    serve({});
    renderWithQuery(<UsersPage />);

    await screen.findByText("admin@acme.com");
    expect(usersRequests()[0]).not.toContain("includeDeleted");

    await userEvent.setup().click(screen.getByLabelText("Show deactivated"));

    await waitFor(() => {
      expect(usersRequests().at(-1)).toContain("includeDeleted=true");
    });
  });

  it("pagina pelo servidor e desliga os botões nos extremos", async () => {
    serve({ total: 42, totalPages: 3 });
    renderWithQuery(<UsersPage />);

    await screen.findByText("admin@acme.com");
    expect(screen.getByText(/42 users/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    await userEvent.setup().click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(usersRequests().at(-1)).toContain("page=2");
    });
  });
});

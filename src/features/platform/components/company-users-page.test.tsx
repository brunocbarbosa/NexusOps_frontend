import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { jsonResponse } from "../../../test/http";
import { renderWithQuery } from "../../../test/query-wrapper";
import { CompanyUsersPage } from "./company-users-page";

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
});

const company = {
  id: "c1",
  name: "Acme Industries",
  domain: "acme.example",
  isActive: true,
  createdAt: "2026-08-23T13:29:18.546Z",
};

const users = [
  {
    id: "u1",
    email: "admin@acme.example",
    role: "ADMIN" as const,
    createdAt: "2026-08-23T13:29:18.546Z",
    deletedAt: null,
  },
];

function serve(options: { companyStatus?: number } = {}) {
  fetchMock.mockImplementation((url: string) => {
    const isUsers = url.includes("/users");

    if (!isUsers) {
      if (options.companyStatus) {
        return Promise.resolve(
          jsonResponse(
            { message: "No company c1", statusCode: options.companyStatus },
            options.companyStatus,
          ),
        );
      }
      return Promise.resolve(jsonResponse(company));
    }

    return Promise.resolve(
      jsonResponse({
        data: users,
        meta: { total: 1, page: 1, perPage: 20, totalPages: 1 },
      }),
    );
  });
}

function usersRequests(): string[] {
  return fetchMock.mock.calls
    .map(([url]) => String(url))
    .filter((url) => url.includes("/users"));
}

describe("CompanyUsersPage", () => {
  it("busca os usuários escopados na company, não em /api/users", async () => {
    serve();
    renderWithQuery(<CompanyUsersPage companyId="c1" />);

    expect(await screen.findByText("admin@acme.example")).toBeInTheDocument();
    expect(usersRequests()[0]).toContain("/api/platform/companies/c1/users");
  });

  it("mostra o nome da company e o caminho de volta", async () => {
    serve();
    renderWithQuery(<CompanyUsersPage companyId="c1" />);

    expect(await screen.findByText("Acme Industries")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Companies/ })).toHaveAttribute(
      "href",
      "/platform/companies",
    );
  });

  it("dá ao operador criar e ver desativados sem ele ser ADMIN de company", async () => {
    serve();
    renderWithQuery(<CompanyUsersPage companyId="c1" />);
    await screen.findByText("admin@acme.example");

    expect(screen.getByRole("button", { name: /New user/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Show deactivated")).toBeInTheDocument();
  });

  it("pede includeDeleted=true quando o operador liga a chave", async () => {
    serve();
    renderWithQuery(<CompanyUsersPage companyId="c1" />);
    await screen.findByText("admin@acme.example");

    await userEvent.setup().click(screen.getByLabelText("Show deactivated"));

    await waitFor(() => {
      expect(usersRequests().at(-1)).toContain("includeDeleted=true");
    });
  });

  it("trata 404 como 'não existe', nunca como 'existe em outro tenant'", async () => {
    // O backend responde 404 e não 403 justamente para não confirmar que o id
    // existe em algum lugar. A tela não pode desfazer isso.
    serve({ companyStatus: 404 });
    renderWithQuery(<CompanyUsersPage companyId="c1" />);

    expect(await screen.findByText("Company not found")).toBeInTheDocument();
    expect(screen.queryByText(/permission/i)).not.toBeInTheDocument();
  });

  it("explica o 403, que é sobre papel e não sobre o recurso", async () => {
    serve({ companyStatus: 403 });
    renderWithQuery(<CompanyUsersPage companyId="c1" />);

    expect(
      await screen.findByText("You don't have access to this page"),
    ).toBeInTheDocument();
  });
});

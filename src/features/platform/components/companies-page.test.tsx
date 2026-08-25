import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { jsonResponse, parseRequestBody } from "../../../test/http";
import { renderWithQuery } from "../../../test/query-wrapper";
import { CompaniesPage } from "./companies-page";

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
});

const companies = [
  {
    id: "c1",
    name: "Acme Industries",
    domain: "acme.example",
    isActive: true,
    createdAt: "2026-08-23T13:29:18.546Z",
  },
  {
    id: "c2",
    name: "Globex",
    domain: null,
    isActive: false,
    createdAt: "2026-08-24T10:00:00.000Z",
  },
];

function serve(options: { status?: number; total?: number; totalPages?: number } = {}) {
  fetchMock.mockImplementation((url: string) => {
    if (options.status && options.status >= 400 && url.startsWith("/api/platform")) {
      return Promise.resolve(
        jsonResponse({ message: "Forbidden resource", statusCode: options.status }, options.status),
      );
    }

    return Promise.resolve(
      jsonResponse({
        data: companies,
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

type Call = [string, RequestInit | undefined];

/** A chamada que casa método e id, já tipada — `mock.calls` é `any[]`. */
function findCall(id: string, method: string): Call | undefined {
  return (fetchMock.mock.calls as Call[]).find(
    ([url, init]) => url.includes(id) && init?.method === method,
  );
}

function companyRequests(): string[] {
  return fetchMock.mock.calls
    .map(([url]) => String(url))
    .filter((url) => url.startsWith("/api/platform/companies"));
}

describe("CompaniesPage", () => {
  it("lista as companies com domínio e status", async () => {
    serve();
    renderWithQuery(<CompaniesPage />);

    expect(await screen.findByText("Acme Industries")).toBeInTheDocument();

    const acme = screen.getByText("Acme Industries").closest("tr") as HTMLElement;
    expect(within(acme).getByRole("checkbox", { name: /is active/ })).toBeChecked();

    const globex = screen.getByText("Globex").closest("tr") as HTMLElement;
    expect(within(globex).getByRole("checkbox", { name: /is active/ })).not.toBeChecked();
    // O backend permite company sem domínio.
    expect(within(globex).getByText("—")).toBeInTheDocument();
  });

  it("explica o 403 em vez de mostrar erro cru — os papéis não são hierárquicos", async () => {
    serve({ status: 403 });
    renderWithQuery(<CompaniesPage />);

    expect(
      await screen.findByText("You don't have access to this page"),
    ).toBeInTheDocument();
  });

  it("omite isActive quando o filtro é 'qualquer status'", async () => {
    // Não existe valor para "as duas": `''` e `'all'` são 400 no backend.
    serve();
    renderWithQuery(<CompaniesPage />);
    await screen.findByText("Acme Industries");

    expect(companyRequests()[0]).not.toContain("isActive");
  });

  it("manda isActive=false ao filtrar por bloqueadas", async () => {
    serve();
    renderWithQuery(<CompaniesPage />);
    await screen.findByText("Acme Industries");

    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Filter by status" }));
    await user.click(await screen.findByRole("option", { name: "Blocked" }));

    await waitFor(() => {
      expect(companyRequests().at(-1)).toContain("isActive=false");
    });
  });

  it("pagina pelo servidor", async () => {
    serve({ total: 42, totalPages: 3 });
    renderWithQuery(<CompaniesPage />);

    await screen.findByText("Acme Industries");
    expect(screen.getByText(/42 companies/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    await userEvent.setup().click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(companyRequests().at(-1)).toContain("page=2");
    });
  });
});

describe("bloquear uma company", () => {
  it("não muta no clique da caixinha — confirma primeiro", async () => {
    serve();
    renderWithQuery(<CompaniesPage />);
    await screen.findByText("Acme Industries");

    const acme = screen.getByText("Acme Industries").closest("tr") as HTMLElement;
    await userEvent
      .setup()
      .click(within(acme).getByRole("checkbox", { name: /is active/ }));

    expect(await screen.findByText("Block this company?")).toBeInTheDocument();
    // Nada de PATCH ainda: a caixinha ainda reflete o servidor.
    expect(companyRequests().every((url) => !url.includes("/c1"))).toBe(true);
  });

  it("manda PATCH isActive:false ao confirmar", async () => {
    serve();
    renderWithQuery(<CompaniesPage />);
    await screen.findByText("Acme Industries");

    const user = userEvent.setup();
    const acme = screen.getByText("Acme Industries").closest("tr") as HTMLElement;
    await user.click(within(acme).getByRole("checkbox", { name: /is active/ }));
    await screen.findByText("Block this company?");
    await user.click(screen.getByRole("button", { name: "Block" }));

    await waitFor(() => {
      const call = findCall("/c1", "PATCH");
      expect(call).toBeDefined();
      expect(parseRequestBody(call![1]!)).toEqual({ isActive: false });
    });
  });

  it("desbloqueia quem está bloqueada", async () => {
    serve();
    renderWithQuery(<CompaniesPage />);
    await screen.findByText("Globex");

    const user = userEvent.setup();
    const globex = screen.getByText("Globex").closest("tr") as HTMLElement;
    await user.click(within(globex).getByRole("checkbox", { name: /is active/ }));

    expect(await screen.findByText("Unblock this company?")).toBeInTheDocument();
  });
});

describe("apagar uma company", () => {
  async function openDelete() {
    serve();
    renderWithQuery(<CompaniesPage />);
    await screen.findByText("Acme Industries");

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Actions for Acme Industries" }),
    );
    await user.click(await screen.findByRole("menuitem", { name: /Delete permanently/ }));
    await screen.findByText(/Delete Acme Industries permanently\?/);

    return user;
  }

  it("mantém o botão desabilitado até o nome ser digitado exatamente", async () => {
    const user = await openDelete();

    const confirm = screen.getByRole("button", { name: "Delete permanently" });
    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText(/Type/), "Acme");
    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText(/Type/), " Industries");
    expect(confirm).toBeEnabled();
  });

  it("oferece bloquear, que é o que quase todo mundo queria e tem volta", async () => {
    const user = await openDelete();

    await user.click(screen.getByRole("button", { name: /Block the company instead/ }));

    expect(await screen.findByText("Block this company?")).toBeInTheDocument();
  });

  it("chama DELETE só depois da confirmação digitada", async () => {
    const user = await openDelete();

    await user.type(screen.getByLabelText(/Type/), "Acme Industries");
    await user.click(screen.getByRole("button", { name: "Delete permanently" }));

    await waitFor(() => {
      expect(findCall("/c1", "DELETE")).toBeDefined();
    });
  });
});

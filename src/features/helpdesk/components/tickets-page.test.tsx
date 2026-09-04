import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { jsonResponse } from "../../../test/http";
import { giveJsdomLayout } from "../../../test/layout";
import { renderWithQuery } from "../../../test/query-wrapper";
import type { Role } from "../../identity/types";
import type { Ticket } from "../types";
import { TicketsPage } from "./tickets-page";

const pushMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: jest.fn() }),
}));

const fetchMock = jest.fn();

beforeEach(() => {
  giveJsdomLayout();
  fetchMock.mockReset();
  pushMock.mockReset();
  globalThis.fetch = fetchMock;
});

const requester = {
  id: "u1",
  email: "req@acme.com",
  role: "REQUESTER" as const,
  createdAt: "2026-08-01T00:00:00.000Z",
  deletedAt: null,
};

const agent = {
  id: "u2",
  email: "agent@acme.com",
  role: "AGENT" as const,
  createdAt: "2026-08-01T00:00:00.000Z",
  deletedAt: null,
};

function ticket(number: number, patch: Partial<Ticket> = {}): Ticket {
  return {
    id: `t${String(number)}`,
    number,
    title: `Ticket number ${String(number)}`,
    description: null,
    status: "OPEN",
    priority: "MEDIUM",
    category: "OTHER",
    version: 1,
    requester,
    assignee: null,
    closedBy: null,
    resolvedAt: null,
    closedAt: null,
    createdAt: "2026-09-01T09:00:00.000Z",
    updatedAt: "2026-09-01T09:00:00.000Z",
    ...patch,
  };
}

/** Roteia por URL: a tela busca sessão, listagem e (para staff) os agentes. */
function serve(options: {
  role?: Role;
  pages?: Ticket[][];
  total?: number;
  ticketsStatus?: number;
} = {}) {
  const pages = options.pages ?? [[ticket(1), ticket(2)]];

  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url.startsWith("/api/auth/me")) {
      return Promise.resolve(
        jsonResponse({
          id: "u1",
          tenantId: "t1",
          email: "someone@acme.com",
          role: options.role ?? "REQUESTER",
        }),
      );
    }

    if (url.startsWith("/api/users")) {
      return Promise.resolve(
        jsonResponse({
          data: url.includes("role=AGENT") ? [agent] : [],
          meta: { total: 1, page: 1, perPage: 100, totalPages: 1 },
        }),
      );
    }

    if (init?.method === "POST") {
      return Promise.resolve(jsonResponse(ticket(9, { id: "t9" }), 201));
    }

    if (options.ticketsStatus && options.ticketsStatus >= 400) {
      return Promise.resolve(
        jsonResponse(
          { message: "Boom", statusCode: options.ticketsStatus },
          options.ticketsStatus,
        ),
      );
    }

    const page = Number(new URLSearchParams(url.split("?")[1]).get("page") ?? "1");

    return Promise.resolve(
      jsonResponse({
        data: pages[page - 1] ?? [],
        meta: {
          total: options.total ?? pages.flat().length,
          page,
          perPage: 50,
          totalPages: pages.length,
        },
      }),
    );
  });
}

function listedUrls(): string[] {
  return (fetchMock.mock.calls as [string][])
    .map(([url]) => url)
    .filter((url) => url.startsWith("/api/tickets"));
}

describe("TicketsPage", () => {
  it("lista os chamados", async () => {
    serve();
    renderWithQuery(<TicketsPage />);

    expect(await screen.findByText("Ticket number 1")).toBeInTheDocument();
    expect(screen.getByText("Ticket number 2")).toBeInTheDocument();
  });

  it("mostra o total do servidor, que respeita visibilidade", async () => {
    // 142 chamados com 2 carregados: o número é o do backend, não o do que já
    // veio — e para um requester ele já conta só os dele.
    serve({ total: 142 });
    renderWithQuery(<TicketsPage />);

    expect(await screen.findByText("142 tickets")).toBeInTheDocument();
  });

  it("não oferece paginador — as páginas se acumulam", async () => {
    serve({ pages: [[ticket(1)], [ticket(2)]] });
    renderWithQuery(<TicketsPage />);

    await screen.findByText("Ticket number 1");
    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /previous/i }),
    ).not.toBeInTheDocument();
  });

  it("não oferece cabeçalho clicável para ordenar, porque a API não ordena", async () => {
    serve();
    renderWithQuery(<TicketsPage />);

    await screen.findByText("Ticket number 1");
    for (const header of screen.getAllByRole("columnheader")) {
      expect(within(header).queryByRole("button")).not.toBeInTheDocument();
    }
  });

  it("acumula a página seguinte sozinha quando há mais", async () => {
    serve({ pages: [[ticket(1)], [ticket(2)]] });
    renderWithQuery(<TicketsPage />);

    expect(await screen.findByText("Ticket number 1")).toBeInTheDocument();
    expect(await screen.findByText("Ticket number 2")).toBeInTheDocument();
  });

  it("para de pedir páginas quando a última chegou", async () => {
    serve({ pages: [[ticket(1)]] });
    renderWithQuery(<TicketsPage />);

    await screen.findByText("Ticket number 1");
    await waitFor(() => {
      expect(listedUrls()).toHaveLength(1);
    });
  });

  it("manda status, prioridade e categoria como o backend os nomeia", async () => {
    serve({ role: "AGENT" });
    const user = userEvent.setup();
    renderWithQuery(<TicketsPage />);

    await screen.findByText("Ticket number 1");
    await user.click(screen.getByRole("combobox", { name: /filter by status/i }));
    await user.click(await screen.findByRole("option", { name: "In progress" }));

    await waitFor(() => {
      expect(listedUrls().some((url) => url.includes("status=IN_PROGRESS"))).toBe(true);
    });
  });

  it("traduz 'Unassigned' para um parâmetro só, nunca os dois", async () => {
    // `unassigned` e `assigneeId` juntos são 400 no backend. O filtro é um
    // controle só justamente para que a requisição contraditória não exista.
    serve({ role: "AGENT" });
    const user = userEvent.setup();
    renderWithQuery(<TicketsPage />);

    await screen.findByText("Ticket number 1");
    await user.click(screen.getByRole("combobox", { name: /filter by assignee/i }));
    await user.click(await screen.findByRole("option", { name: "Unassigned" }));

    await waitFor(() => {
      const withFilter = listedUrls().find((url) => url.includes("assignee="));
      expect(withFilter).toBeDefined();
    });
    const withFilter = listedUrls().find((url) => url.includes("assignee="));
    expect(withFilter).toContain("assignee=unassigned");
    expect(withFilter).not.toContain("assigneeId=");
  });

  it("esconde o filtro de responsável de um requester", async () => {
    // Ele veria a lista dele de qualquer jeito: o backend sobrescreve o filtro.
    // Um controle que não muda nada é pior que controle nenhum.
    serve({ role: "REQUESTER" });
    renderWithQuery(<TicketsPage />);

    await screen.findByText("Ticket number 1");
    expect(
      screen.queryByRole("combobox", { name: /filter by assignee/i }),
    ).not.toBeInTheDocument();
  });

  it("deixa qualquer papel abrir um chamado", async () => {
    serve({ role: "REQUESTER" });
    renderWithQuery(<TicketsPage />);

    expect(
      await screen.findByRole("button", { name: /new ticket/i }),
    ).toBeInTheDocument();
  });

  it("leva para o chamado recém-aberto em vez de voltar para a lista filtrada", async () => {
    serve();
    const user = userEvent.setup();
    renderWithQuery(<TicketsPage />);

    await screen.findByText("Ticket number 1");
    await user.click(screen.getByRole("button", { name: /new ticket/i }));
    await user.type(
      await screen.findByLabelText("Title"),
      "Printer on the 3rd floor is jammed",
    );
    await user.click(screen.getByRole("button", { name: /open ticket/i }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/tickets/t9");
    });
  });

  it("mostra o erro da listagem sem sumir com a tela", async () => {
    serve({ ticketsStatus: 500 });
    renderWithQuery(<TicketsPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Boom");
    expect(screen.getByRole("button", { name: /new ticket/i })).toBeInTheDocument();
  });
});

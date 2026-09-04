import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { jsonResponse } from "../../../test/http";
import { renderWithQuery } from "../../../test/query-wrapper";
import type { Ticket } from "../types";
import { TicketPage } from "./ticket-page";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
});

const requester = {
  id: "u1",
  email: "req@acme.com",
  role: "REQUESTER" as const,
  createdAt: "2026-08-01T00:00:00.000Z",
  deletedAt: null,
};

function ticket(patch: Partial<Ticket> = {}): Ticket {
  return {
    id: "t1",
    number: 42,
    title: "Printer jammed",
    description: "It jams on every duplex job.",
    status: "OPEN",
    priority: "MEDIUM",
    category: "HARDWARE",
    version: 3,
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

const CONFLICT = {
  message:
    "This ticket was changed by someone else (it is now at version 4). Reload it and reapply your change.",
  error: "Conflict",
  statusCode: 409,
};

/**
 * O servidor da encenação: o chamado está na versão 3 na tela e na 4 no
 * servidor, porque outra pessoa mudou a prioridade nesse meio-tempo.
 */
function serveConflictThenAccept() {
  const patches: unknown[] = [];
  let current = ticket({ version: 3 });

  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url.startsWith("/api/auth/me")) {
      return Promise.resolve(
        jsonResponse({ id: "u1", tenantId: "t1", email: "req@acme.com", role: "REQUESTER" }),
      );
    }

    if (url.includes("/history")) {
      return Promise.resolve(jsonResponse({ data: [], truncated: false }));
    }

    if (init?.method === "PATCH") {
      const body = JSON.parse(init.body as string) as { version: number };
      patches.push(body);

      if (body.version !== current.version) {
        return Promise.resolve(jsonResponse(CONFLICT, 409));
      }

      current = { ...current, ...body, version: current.version + 1 };
      return Promise.resolve(jsonResponse(current));
    }

    return Promise.resolve(jsonResponse(current));
  });

  return {
    patches,
    /** Outra pessoa salvou primeiro: a versão do servidor anda sem a tela saber. */
    someoneElseSaves: (patch: Partial<Ticket>) => {
      current = { ...current, ...patch, version: current.version + 1 };
    },
  };
}

/** Só os GET do chamado — nem o histórico, nem a sessão, nem os PATCH. */
function ticketGets(): number {
  return (fetchMock.mock.calls as [string, RequestInit | undefined][]).filter(
    ([url, init]) => url === "/api/tickets/t1" && (init?.method ?? "GET") === "GET",
  ).length;
}

async function editTitle(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(await screen.findByRole("button", { name: "Edit" }));
  const field = await screen.findByLabelText("Title");
  await user.clear(field);
  await user.type(field, title);
  await user.click(screen.getByRole("button", { name: "Save" }));
}

describe("conflito de versão", () => {
  it("abre o diálogo em vez de um alerta genérico", async () => {
    const server = serveConflictThenAccept();
    const user = userEvent.setup();
    renderWithQuery(<TicketPage ticketId="t1" />);

    await screen.findByText("#42");
    server.someoneElseSaves({ priority: "URGENT" });
    await editTitle(user, "Printer jammed on duplex");

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/someone else changed this ticket/i),
    ).toBeInTheDocument();
  });

  it("diz de qual versão para qual", async () => {
    const server = serveConflictThenAccept();
    const user = userEvent.setup();
    renderWithQuery(<TicketPage ticketId="t1" />);

    await screen.findByText("#42");
    server.someoneElseSaves({ priority: "URGENT" });
    await editTitle(user, "Printer jammed on duplex");

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/version 3/)).toBeInTheDocument();
    expect(within(dialog).getByText(/version 4/)).toBeInTheDocument();
  });

  it("mostra o valor do servidor ao lado do que se tentou salvar", async () => {
    const server = serveConflictThenAccept();
    const user = userEvent.setup();
    renderWithQuery(<TicketPage ticketId="t1" />);

    await screen.findByText("#42");
    server.someoneElseSaves({ priority: "URGENT" });
    await editTitle(user, "Printer jammed on duplex");

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Printer jammed")).toBeInTheDocument();
    expect(within(dialog).getByText("Printer jammed on duplex")).toBeInTheDocument();
    // A prioridade que o outro salvou aparece como diferença também.
    expect(within(dialog).getByText("Urgent")).toBeInTheDocument();
  });

  it("não mostra o alerta inline junto do diálogo", async () => {
    // Os dois ao mesmo tempo diriam coisas diferentes sobre um erro só: o
    // alerta pedindo para tentar de novo, o diálogo explicando por que não.
    const server = serveConflictThenAccept();
    const user = userEvent.setup();
    renderWithQuery(<TicketPage ticketId="t1" />);

    await screen.findByText("#42");
    server.someoneElseSaves({ priority: "URGENT" });
    await editTitle(user, "Printer jammed on duplex");

    await screen.findByRole("dialog");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("recarrega o chamado antes de oferecer a escolha", async () => {
    // Sem o refetch, o diálogo compararia a mudança contra o dado velho e o
    // "reaplicar" sairia de novo com a versão vencida.
    const server = serveConflictThenAccept();
    const user = userEvent.setup();
    renderWithQuery(<TicketPage ticketId="t1" />);

    await screen.findByText("#42");
    const before = ticketGets();

    server.someoneElseSaves({ priority: "URGENT" });
    await editTitle(user, "Printer jammed on duplex");

    await screen.findByRole("dialog");
    await waitFor(() => {
      expect(ticketGets()).toBeGreaterThan(before);
    });
  });

  it("reaplica com a versão nova, e a mudança passa", async () => {
    const server = serveConflictThenAccept();
    const user = userEvent.setup();
    renderWithQuery(<TicketPage ticketId="t1" />);

    await screen.findByText("#42");
    server.someoneElseSaves({ priority: "URGENT" });
    await editTitle(user, "Printer jammed on duplex");

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /reapply mine/i }));

    await waitFor(() => {
      expect(server.patches).toHaveLength(2);
    });
    // A primeira tentativa saiu com a versão velha; a segunda, com a do
    // servidor — sem que ninguém a tenha digitado.
    expect(server.patches[0]).toMatchObject({ version: 3 });
    expect(server.patches[1]).toMatchObject({
      version: 4,
      title: "Printer jammed on duplex",
    });
  });

  it("nunca repete a requisição sozinho", async () => {
    // Repetir com a mesma versão só produz outro 409. O retry automático do
    // TanStack Query está desligado, e nada aqui o reintroduz.
    const server = serveConflictThenAccept();
    const user = userEvent.setup();
    renderWithQuery(<TicketPage ticketId="t1" />);

    await screen.findByText("#42");
    server.someoneElseSaves({ priority: "URGENT" });
    await editTitle(user, "Printer jammed on duplex");

    await screen.findByRole("dialog");
    expect(server.patches).toHaveLength(1);
  });

  it("descartar fecha o diálogo e mantém o que o servidor tem", async () => {
    const server = serveConflictThenAccept();
    const user = userEvent.setup();
    renderWithQuery(<TicketPage ticketId="t1" />);

    await screen.findByText("#42");
    server.someoneElseSaves({ priority: "URGENT" });
    await editTitle(user, "Printer jammed on duplex");

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /keep theirs/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(server.patches).toHaveLength(1);
  });
});

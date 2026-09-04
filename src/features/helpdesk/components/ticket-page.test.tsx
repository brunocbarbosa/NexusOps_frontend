import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { jsonResponse } from "../../../test/http";
import { renderWithQuery } from "../../../test/query-wrapper";
import type { Role } from "../../identity/types";
import type { AuditEntry, Comment, Ticket } from "../types";
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

const agent = {
  id: "u2",
  email: "agent@acme.com",
  role: "AGENT" as const,
  createdAt: "2026-08-01T00:00:00.000Z",
  deletedAt: null,
};

function ticket(patch: Partial<Ticket> = {}): Ticket {
  return {
    id: "t1",
    number: 42,
    title: "Printer on the 3rd floor is jammed",
    description: "It jams on every duplex job.",
    status: "OPEN",
    priority: "HIGH",
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

const created: AuditEntry = {
  id: "a1",
  entityType: "Ticket",
  entityId: "t1",
  action: "created",
  oldValues: {},
  newValues: { title: "Printer on the 3rd floor is jammed", number: 42 },
  user: requester,
  createdAt: "2026-09-01T09:00:00.000Z",
};

const comment: Comment = {
  id: "c1",
  ticketId: "t1",
  body: "Still jamming this morning.",
  isInternal: false,
  author: requester,
  createdAt: "2026-09-01T10:00:00.000Z",
};

function serve(options: {
  role?: Role;
  ticket?: Ticket;
  ticketStatus?: number;
  history?: { entry: AuditEntry | null; comment: Comment | null; createdAt: string }[];
  onPost?: (url: string, init: RequestInit) => Response;
} = {}) {
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

    if (url.includes("/history")) {
      return Promise.resolve(
        jsonResponse({
          data: options.history ?? [
            { createdAt: created.createdAt, entry: created, comment: null },
            { createdAt: comment.createdAt, entry: null, comment },
          ],
          truncated: false,
        }),
      );
    }

    if (init?.method && init.method !== "GET" && options.onPost) {
      return Promise.resolve(options.onPost(url, init));
    }

    if (options.ticketStatus && options.ticketStatus >= 400) {
      return Promise.resolve(
        jsonResponse(
          { message: "No ticket t1", statusCode: options.ticketStatus },
          options.ticketStatus,
        ),
      );
    }

    return Promise.resolve(jsonResponse(options.ticket ?? ticket()));
  });
}

describe("TicketPage", () => {
  it("mostra o número, o título e a descrição", async () => {
    serve();
    renderWithQuery(<TicketPage ticketId="t1" />);

    expect(await screen.findByText("#42")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Printer on the 3rd floor is jammed" }),
    ).toBeInTheDocument();
    expect(screen.getByText("It jams on every duplex job.")).toBeInTheDocument();
  });

  it("renderiza o 404 como 'não encontrado', com volta para a lista", async () => {
    // 404 é a regra de visibilidade, não uma falha: a mesma URL responde 200
    // para um agente. Um alerta genérico faria a pessoa abrir um chamado
    // reclamando de um chamado.
    serve({ ticketStatus: 404 });
    renderWithQuery(<TicketPage ticketId="t1" />);

    expect(
      await screen.findByRole("heading", { name: /ticket not found/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to all tickets/i })).toHaveAttribute(
      "href",
      "/tickets",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("intercala a trilha e a thread numa lista só", async () => {
    serve();
    renderWithQuery(<TicketPage ticketId="t1" />);

    expect(await screen.findByText(/opened this ticket/)).toBeInTheDocument();
    expect(screen.getByText("Still jamming this morning.")).toBeInTheDocument();
  });

  it("mostra um comentário cuja entrada de auditoria ainda não chegou", async () => {
    // A trilha é escrita depois da resposta. O texto é a fonte, então ele
    // aparece na hora.
    serve({ history: [{ createdAt: comment.createdAt, entry: null, comment }] });
    renderWithQuery(<TicketPage ticketId="t1" />);

    expect(await screen.findByText("Still jamming this morning.")).toBeInTheDocument();
  });

  it("esconde as ações de staff de um requester", async () => {
    serve({ role: "REQUESTER" });
    renderWithQuery(<TicketPage ticketId="t1" />);

    await screen.findByText("#42");
    expect(screen.queryByRole("combobox", { name: /assignee/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start work/i })).not.toBeInTheDocument();
  });

  it("esconde o switch de nota interna de um requester", async () => {
    serve({ role: "REQUESTER" });
    renderWithQuery(<TicketPage ticketId="t1" />);

    await screen.findByText("#42");
    expect(screen.queryByLabelText(/internal note/i)).not.toBeInTheDocument();
  });

  it("oferece a um agente só as transições legais", async () => {
    serve({ role: "AGENT", ticket: ticket({ status: "RESOLVED" }) });
    renderWithQuery(<TicketPage ticketId="t1" />);

    expect(await screen.findByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reopen" })).toBeInTheDocument();
    // O backend recusa RESOLVED -> IN_PROGRESS com 409; o botão não existe.
    expect(screen.queryByRole("button", { name: /start work/i })).not.toBeInTheDocument();
  });

  it("não oferece saída de um chamado fechado", async () => {
    serve({ role: "AGENT", ticket: ticket({ status: "CLOSED" }) });
    renderWithQuery(<TicketPage ticketId="t1" />);

    expect(await screen.findByText(/closed is final/i)).toBeInTheDocument();
  });

  it("manda o status e a versão do cache ao mover o chamado", async () => {
    const calls: { url: string; body: unknown }[] = [];
    serve({
      role: "AGENT",
      onPost: (url, init) => {
        calls.push({ url, body: JSON.parse(init.body as string) });
        return jsonResponse(ticket({ status: "IN_PROGRESS", version: 4 }));
      },
    });
    const user = userEvent.setup();
    renderWithQuery(<TicketPage ticketId="t1" />);

    await user.click(await screen.findByRole("button", { name: /start work/i }));

    await waitFor(() => {
      expect(calls).toHaveLength(1);
    });
    expect(calls[0].url).toBe("/api/tickets/t1/status");
    expect(calls[0].body).toEqual({ status: "IN_PROGRESS", version: 3 });
  });

  it("mostra o 409 de transição inline, sem diálogo", async () => {
    // É 409 e não é conflito de versão: recarregar não ajudaria.
    serve({
      role: "AGENT",
      onPost: () =>
        jsonResponse(
          { message: "A ticket cannot go from RESOLVED to IN_PROGRESS", statusCode: 409 },
          409,
        ),
    });
    const user = userEvent.setup();
    renderWithQuery(<TicketPage ticketId="t1" />);

    await user.click(await screen.findByRole("button", { name: /start work/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A ticket cannot go from RESOLVED to IN_PROGRESS",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("desatribui com null explícito, e não com a ausência do campo", async () => {
    const bodies: unknown[] = [];
    serve({
      role: "AGENT",
      ticket: ticket({ assignee: agent }),
      onPost: (_url, init) => {
        bodies.push(JSON.parse(init.body as string));
        return jsonResponse(ticket({ version: 4 }));
      },
    });
    const user = userEvent.setup();
    renderWithQuery(<TicketPage ticketId="t1" />);

    await user.click(await screen.findByRole("combobox", { name: /assignee/i }));
    await user.click(await screen.findByRole("option", { name: "Unassigned" }));

    await waitFor(() => {
      expect(bodies).toEqual([{ assigneeId: null, version: 3 }]);
    });
  });

  it("recusa comentário num chamado fechado, explicando em vez de errar", async () => {
    serve({ ticket: ticket({ status: "CLOSED" }) });
    renderWithQuery(<TicketPage ticketId="t1" />);

    expect(await screen.findByText(/takes no new comments/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/add a comment/i)).not.toBeInTheDocument();
  });

  it("manda isInternal como booleano quando o agente marca a nota", async () => {
    const bodies: unknown[] = [];
    serve({
      role: "AGENT",
      onPost: (_url, init) => {
        bodies.push(JSON.parse(init.body as string));
        return jsonResponse({ id: "c2" }, 201);
      },
    });
    const user = userEvent.setup();
    renderWithQuery(<TicketPage ticketId="t1" />);

    await user.type(await screen.findByLabelText(/add a comment/i), "Waiting on the vendor.");
    await user.click(screen.getByLabelText(/internal note/i));
    await user.click(screen.getByRole("button", { name: /add note/i }));

    await waitFor(() => {
      expect(bodies).toEqual([
        { body: "Waiting on the vendor.", isInternal: true },
      ]);
    });
  });

  it("omite isInternal num comentário comum, em vez de mandar false", async () => {
    const bodies: unknown[] = [];
    serve({
      role: "AGENT",
      onPost: (_url, init) => {
        bodies.push(JSON.parse(init.body as string));
        return jsonResponse({ id: "c2" }, 201);
      },
    });
    const user = userEvent.setup();
    renderWithQuery(<TicketPage ticketId="t1" />);

    await user.type(await screen.findByLabelText(/add a comment/i), "Any news?");
    await user.click(screen.getByRole("button", { name: /^comment$/i }));

    await waitFor(() => {
      expect(bodies).toEqual([{ body: "Any news?" }]);
    });
  });

  it("marca a nota interna no feed para quem a enxerga", async () => {
    serve({
      role: "AGENT",
      history: [
        {
          createdAt: "2026-09-01T11:00:00.000Z",
          entry: null,
          comment: { ...comment, id: "c3", body: "Vendor said friday.", isInternal: true, author: agent },
        },
      ],
    });
    renderWithQuery(<TicketPage ticketId="t1" />);

    expect(await screen.findByText("Vendor said friday.")).toBeInTheDocument();
    // Texto exato: o rótulo do switch do compositor também contém "internal
    // note", e /regex/i casaria com os dois.
    expect(screen.getByText("Internal note")).toBeInTheDocument();
  });
});

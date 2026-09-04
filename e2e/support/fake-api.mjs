/**
 * Dublê do backend NestJS para os testes E2E.
 *
 * Serve os mesmos caminhos, os mesmos códigos e o mesmo envelope de erro
 * descritos em `documents/backend/USERS.md` e `documents/backend/PLATFORM.md` —
 * inclusive o 409 que aponta o usuário desativado e o 401 genérico de company
 * bloqueada, que são os dois fluxos mais interessantes das telas.
 *
 * Existe para que `npm run e2e` não dependa de Postgres, Redis e do backend
 * rodando. O que ele **não** substitui é a verificação manual contra a API de
 * verdade, descrita na spec de cada fatia.
 */
import { createServer } from "node:http";

const PORT = Number(process.env.FAKE_API_PORT ?? 3101);

const PASSWORD = "correct horse battery";

/**
 * O tenant reservado da plataforma.
 *
 * Não é uma company: nunca aparece em `GET /platform/companies`, e o id dele
 * responde **404** em toda rota aninhada. Sem essa metade, o operador poderia
 * se desativar por `/platform/companies/<platform>/users/<self>` e a instalação
 * ficaria sem ninguém — um dublê que devolvesse 200 ali ensinaria um
 * comportamento que a API real não tem.
 */
const PLATFORM_TENANT_ID = "00000000-0000-4000-8000-000000000000";
const PLATFORM_DOMAIN = "platform";

const OPERATOR = {
  id: "99999999-9999-4999-8999-999999999999",
  email: "admin@nexusops.local",
  role: "ADMIN_MASTER",
  companyId: PLATFORM_TENANT_ID,
  createdAt: "2026-08-19T10:00:00.000Z",
  deletedAt: null,
};

const ACME = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Acme Inc",
  domain: "acme.com",
  isActive: true,
  createdAt: "2026-08-20T09:00:00.000Z",
};

let companies = [];
let users = [];
let tickets = [];
let comments = [];
let auditLogs = [];
/** Um contador por company: `tickets.number` recomeça em 1 em cada uma. */
let ticketCounters = new Map();
let nextId = 0;
let issued = 0;

/**
 * Sessões vivas, do token para o id do dono.
 *
 * O dublê guarda o que emitiu porque a rotação e a detecção de reuso são
 * justamente o que o frontend tem de acertar: apresentar um refresh token já
 * gasto revoga **toda** a família daquele usuário, e foi assim que a primeira
 * versão do cliente derrubava a sessão de quem navegava.
 */
const liveAccessTokens = new Map();
const liveRefreshTokens = new Map();

function reset() {
  liveAccessTokens.clear();
  liveRefreshTokens.clear();
  issued = 0;
  nextId = 0;
  companies = [{ ...ACME }];
  users = [
    { ...OPERATOR },
    {
      id: "22222222-2222-4222-8222-222222222222",
      email: "admin@acme.com",
      role: "ADMIN",
      companyId: ACME.id,
      createdAt: "2026-08-20T10:00:00.000Z",
      deletedAt: null,
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      email: "agent@acme.com",
      role: "AGENT",
      companyId: ACME.id,
      createdAt: "2026-08-21T10:00:00.000Z",
      deletedAt: null,
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      email: "ghost@acme.com",
      role: "REQUESTER",
      companyId: ACME.id,
      createdAt: "2026-08-22T10:00:00.000Z",
      deletedAt: "2026-08-23T10:00:00.000Z",
    },
    // Dois requesters ativos, e os dois são necessários: a regra de
    // visibilidade só é testável com um colega de sala para não enxergar o
    // chamado do outro.
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      email: "req@acme.com",
      role: "REQUESTER",
      companyId: ACME.id,
      createdAt: "2026-08-24T10:00:00.000Z",
      deletedAt: null,
    },
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      email: "other@acme.com",
      role: "REQUESTER",
      companyId: ACME.id,
      createdAt: "2026-08-25T10:00:00.000Z",
      deletedAt: null,
    },
  ];
  tickets = [];
  comments = [];
  auditLogs = [];
  ticketCounters = new Map([[ACME.id, 0]]);
}

reset();

function send(response, status, body) {
  if (body === undefined) {
    response.writeHead(status);
    response.end();
    return;
  }

  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
  });
  response.end(payload);
}

function fail(response, status, message, error) {
  send(response, status, { message, error, statusCode: status });
}

/** `UserResponse` — a projeção que a API devolve. `companyId` nunca sai daqui. */
function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    deletedAt: user.deletedAt,
  };
}

function authResult(user) {
  issued += 1;

  const accessToken = `access-${issued}-${user.id}`;
  const refreshToken = `refresh-${issued}-${user.id}`;

  liveAccessTokens.set(accessToken, user.id);
  liveRefreshTokens.set(refreshToken, user.id);

  return { accessToken, refreshToken, user: publicUser(user) };
}

function revokeFamily(userId) {
  for (const [token, owner] of liveAccessTokens) {
    if (owner === userId) liveAccessTokens.delete(token);
  }
  for (const [token, owner] of liveRefreshTokens) {
    if (owner === userId) liveRefreshTokens.delete(token);
  }
}

function authenticated(request) {
  const header = request.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const userId = liveAccessTokens.get(token);

  return userId ? (users.find((user) => user.id === userId) ?? null) : null;
}

function readBody(request) {
  return new Promise((resolve) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
    });
    request.on("end", () => {
      try {
        resolve(raw.length > 0 ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function paginate(rows, url) {
  const page = Number(url.searchParams.get("page") ?? 1);
  const perPage = Number(url.searchParams.get("perPage") ?? 20);

  return {
    data: rows.slice((page - 1) * perPage, page * perPage),
    meta: {
      total: rows.length,
      page,
      perPage,
      // Sempre >= 1, mesmo com total 0.
      totalPages: Math.max(1, Math.ceil(rows.length / perPage)),
    },
  };
}

// --- usuários, o serviço que os dois consoles compartilham ------------------

function listUsers(response, url, companyId, caller) {
  const includeDeleted = url.searchParams.get("includeDeleted") === "true";

  if (includeDeleted && caller.role === "AGENT") {
    // Recusado, e não silenciosamente filtrado: "não pode perguntar" é uma
    // afirmação diferente de "não há nenhum".
    return fail(response, 403, "Only an ADMIN may list deactivated users", "Forbidden");
  }

  const role = url.searchParams.get("role");
  const search = (url.searchParams.get("search") ?? "").toLowerCase();

  const matching = users.filter(
    (user) =>
      user.companyId === companyId &&
      (includeDeleted || user.deletedAt === null) &&
      (!role || user.role === role) &&
      (!search || user.email.toLowerCase().includes(search)),
  );

  const page = paginate(matching, url);

  return send(response, 200, { ...page, data: page.data.map(publicUser) });
}

function createUser(response, body, companyId) {
  const existing = users.find(
    (user) => user.companyId === companyId && user.email === body.email,
  );

  if (existing) {
    return fail(
      response,
      409,
      existing.deletedAt === null
        ? `${existing.email} is already in use`
        : `${existing.email} belongs to a deactivated user (${existing.id}). Restore them instead of creating a duplicate.`,
      "Conflict",
    );
  }

  nextId += 1;
  const created = {
    id: `55555555-5555-4555-8555-00000000000${nextId}`,
    email: body.email,
    role: body.role ?? "REQUESTER",
    companyId,
    createdAt: new Date().toISOString(),
    deletedAt: null,
  };
  users.push(created);

  return send(response, 201, publicUser(created));
}

function mutateUser(response, method, userId, restore, body, companyId, caller) {
  const user = users.find(
    (candidate) => candidate.id === userId && candidate.companyId === companyId,
  );

  // Usuário de outra company responde 404, não 403: um 403 confirmaria que o id
  // existe em algum lugar, que é um fato sobre o dado de outra pessoa.
  if (!user) {
    return fail(response, 404, `No user ${userId}`, "Not Found");
  }

  if (restore && method === "POST") {
    if (user.deletedAt === null) {
      return fail(response, 409, "This user is not deactivated", "Conflict");
    }
    user.deletedAt = null;
    return send(response, 200, publicUser(user));
  }

  if (method === "PATCH") {
    if (body.email !== undefined) user.email = body.email;
    if (body.role !== undefined) user.role = body.role;
    return send(response, 200, publicUser(user));
  }

  if (method === "DELETE") {
    if (user.id === caller.id) {
      return fail(
        response,
        409,
        "You cannot deactivate yourself. Ask another ADMIN to do it.",
        "Conflict",
      );
    }
    user.deletedAt = new Date().toISOString();
    return send(response, 204);
  }

  return fail(response, 404, `Cannot ${method}`, "Not Found");
}


// --- helpdesk ---------------------------------------------------------------

/**
 * Quem enxerga qual chamado. É a regra que faz a mesma URL responder 200 para
 * um agente e **404** para o colega de sala do requester — e não 403, que
 * confirmaria que o id existe em algum lugar.
 */
function visibleTickets(caller) {
  return tickets.filter(
    (ticket) =>
      ticket.companyId === caller.companyId &&
      (isStaff(caller) || ticket.requesterId === caller.id),
  );
}

function isStaff(caller) {
  return caller.role === "ADMIN" || caller.role === "AGENT";
}

function userById(id) {
  const found = users.find((candidate) => candidate.id === id);

  return found ? publicUser(found) : null;
}

/** `TicketResponse`: as três pessoas vêm embutidas, `companyId` nunca sai. */
function publicTicket(ticket) {
  return {
    id: ticket.id,
    number: ticket.number,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    category: ticket.category,
    version: ticket.version,
    requester: userById(ticket.requesterId),
    assignee: ticket.assigneeId ? userById(ticket.assigneeId) : null,
    closedBy: ticket.closedById ? userById(ticket.closedById) : null,
    resolvedAt: ticket.resolvedAt,
    closedAt: ticket.closedAt,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}

function publicComment(comment) {
  return {
    id: comment.id,
    ticketId: comment.ticketId,
    body: comment.body,
    isInternal: comment.isInternal,
    author: userById(comment.authorId),
    createdAt: comment.createdAt,
  };
}

function publicAudit(entry) {
  return {
    id: entry.id,
    entityType: "Ticket",
    entityId: entry.entityId,
    action: entry.action,
    oldValues: entry.oldValues,
    newValues: entry.newValues,
    user: entry.userId ? userById(entry.userId) : null,
    createdAt: entry.createdAt,
  };
}

let clock = 0;

/** Instantes crescentes e distintos, para que a ordenação seja determinística. */
function now() {
  clock += 1;

  return new Date(Date.UTC(2026, 8, 1, 9, 0, clock)).toISOString();
}

function record(ticket, caller, action, oldValues, newValues) {
  nextId += 1;
  auditLogs.push({
    id: `audit-${nextId}`,
    entityId: ticket.id,
    action,
    oldValues,
    newValues,
    userId: caller.id,
    createdAt: now(),
  });
}

/**
 * O conflito de versão, com a versão atual **na mensagem** — é dela que a tela
 * tira o "você estava na 3, ele está na 4". Um 409 genérico faria o teste do
 * diálogo verificar que um modal abre, e não que o conflito foi resolvido.
 */
function versionRefused(response, ticket, version) {
  if (version === ticket.version) {
    return false;
  }

  fail(
    response,
    409,
    `This ticket was changed by someone else (it is now at version ${ticket.version}). Reload it and reapply your change.`,
    "Conflict",
  );

  return true;
}

const TRANSITIONS = {
  OPEN: ["IN_PROGRESS", "RESOLVED"],
  IN_PROGRESS: ["RESOLVED", "OPEN"],
  RESOLVED: ["CLOSED", "OPEN"],
  CLOSED: [],
};

function handleTickets(response, method, pathname, url, body, caller) {
  if (pathname === "/tickets" && method === "GET") {
    const status = url.searchParams.get("status");
    const priority = url.searchParams.get("priority");
    const category = url.searchParams.get("category");
    const assigneeId = url.searchParams.get("assigneeId");
    const unassigned = url.searchParams.get("unassigned");
    const search = (url.searchParams.get("search") ?? "").toLowerCase();

    if (assigneeId && unassigned) {
      return fail(
        response,
        400,
        "unassigned and assigneeId contradict each other. Send one or the other.",
        "Bad Request",
      );
    }

    const matching = visibleTickets(caller)
      .filter(
        (ticket) =>
          (!status || ticket.status === status) &&
          (!priority || ticket.priority === priority) &&
          (!category || ticket.category === category) &&
          (!assigneeId || ticket.assigneeId === assigneeId) &&
          (unassigned !== "true" || ticket.assigneeId === null) &&
          (!search ||
            ticket.title.toLowerCase().includes(search) ||
            (ticket.description ?? "").toLowerCase().includes(search)),
      )
      // Do mais novo para o mais antigo, sempre. Não há parâmetro de ordenação.
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    const page = paginate(matching, url);

    return send(response, 200, { ...page, data: page.data.map(publicTicket) });
  }

  if (pathname === "/tickets" && method === "POST") {
    const last = ticketCounters.get(caller.companyId) ?? 0;
    ticketCounters.set(caller.companyId, last + 1);

    nextId += 1;
    const ticket = {
      id: `ticket-${nextId}`,
      number: last + 1,
      companyId: caller.companyId,
      // O requester é sempre quem chama: não há como abrir em nome de outro.
      requesterId: caller.id,
      assigneeId: null,
      closedById: null,
      title: body.title,
      description: body.description ?? null,
      status: "OPEN",
      priority: body.priority ?? "MEDIUM",
      category: body.category ?? "OTHER",
      version: 1,
      resolvedAt: null,
      closedAt: null,
      createdAt: now(),
      updatedAt: now(),
    };
    tickets.push(ticket);
    record(ticket, caller, "created", {}, {
      number: ticket.number,
      title: ticket.title,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
    });

    return send(response, 201, publicTicket(ticket));
  }

  const match = /^\/tickets\/([^/]+)(?:\/(status|assignee|comments|timeline))?$/.exec(
    pathname,
  );

  if (!match) {
    return null;
  }

  const [, id, sub] = match;
  const ticket = visibleTickets(caller).find((candidate) => candidate.id === id);

  // 404 antes de qualquer outra coisa, inclusive para a thread e a timeline:
  // elas não são um canal lateral para os chamados que a listagem esconde.
  if (!ticket) {
    return fail(response, 404, `No ticket ${id}`, "Not Found");
  }

  if (!sub && method === "GET") {
    return send(response, 200, publicTicket(ticket));
  }

  if (!sub && method === "PATCH") {
    if (ticket.status === "CLOSED") {
      return fail(response, 409, "A closed ticket cannot be edited", "Conflict");
    }
    if (versionRefused(response, ticket, body.version)) return undefined;

    const moved = {};
    const before = {};
    for (const field of ["title", "description", "priority", "category"]) {
      if (body[field] !== undefined && body[field] !== ticket[field]) {
        before[field] = ticket[field];
        moved[field] = body[field];
        ticket[field] = body[field];
      }
    }

    ticket.version += 1;
    ticket.updatedAt = now();
    if (Object.keys(moved).length > 0) {
      record(ticket, caller, "updated", before, moved);
    }

    return send(response, 200, publicTicket(ticket));
  }

  if (sub === "status" && method === "PATCH") {
    if (!isStaff(caller)) {
      return fail(response, 403, "This route requires one of: ADMIN, AGENT", "Forbidden");
    }
    if (versionRefused(response, ticket, body.version)) return undefined;

    if (!TRANSITIONS[ticket.status].includes(body.status)) {
      return fail(
        response,
        409,
        `A ticket cannot go from ${ticket.status} to ${body.status}`,
        "Conflict",
      );
    }

    const from = ticket.status;
    ticket.status = body.status;
    if (body.status === "RESOLVED") ticket.resolvedAt = now();
    // Reabrir descarta a alegação de resolvido; fechar a **mantém**.
    if (body.status === "OPEN") ticket.resolvedAt = null;
    if (body.status === "CLOSED") {
      ticket.closedAt = now();
      ticket.closedById = caller.id;
    }
    ticket.version += 1;
    ticket.updatedAt = now();
    record(ticket, caller, "status_changed", { status: from }, { status: ticket.status });

    return send(response, 200, publicTicket(ticket));
  }

  if (sub === "assignee" && method === "PATCH") {
    if (!isStaff(caller)) {
      return fail(response, 403, "This route requires one of: ADMIN, AGENT", "Forbidden");
    }
    if (versionRefused(response, ticket, body.version)) return undefined;

    const target = body.assigneeId ? userById(body.assigneeId) : null;

    if (body.assigneeId && (!target || target.role === "REQUESTER")) {
      return fail(
        response,
        409,
        `${target ? target.email : body.assigneeId} is a REQUESTER and cannot be assigned a ticket. Only an AGENT or an ADMIN works tickets.`,
        "Conflict",
      );
    }

    const from = ticket.assigneeId;
    ticket.assigneeId = body.assigneeId ?? null;
    ticket.version += 1;
    ticket.updatedAt = now();
    record(
      ticket,
      caller,
      "assigned",
      { assigneeId: from },
      { assigneeId: ticket.assigneeId },
    );

    return send(response, 200, publicTicket(ticket));
  }

  if (sub === "comments" && method === "POST") {
    if (ticket.status === "CLOSED") {
      return fail(response, 409, "A closed ticket takes no new comments", "Conflict");
    }

    if (body.isInternal === true && !isStaff(caller)) {
      // 403 e não 404: o chamado é dele e está visível; falta só o papel.
      return fail(
        response,
        403,
        "Only an ADMIN or an AGENT can leave an internal note",
        "Forbidden",
      );
    }

    nextId += 1;
    const comment = {
      id: `comment-${nextId}`,
      ticketId: ticket.id,
      authorId: caller.id,
      body: body.body,
      isInternal: body.isInternal === true,
      createdAt: now(),
    };
    comments.push(comment);
    record(
      ticket,
      caller,
      comment.isInternal ? "internal_note_added" : "commented",
      null,
      { commentId: comment.id },
    );

    return send(response, 201, publicComment(comment));
  }

  if (sub === "comments" && method === "GET") {
    // A nota interna some da página **e do total** para um requester: um total
    // que contasse o que ele não pode ler anunciaria que algo está escondido.
    const thread = comments
      .filter(
        (comment) =>
          comment.ticketId === ticket.id && (isStaff(caller) || !comment.isInternal),
      )
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

    const page = paginate(thread, url);

    return send(response, 200, { ...page, data: page.data.map(publicComment) });
  }

  if (sub === "timeline" && method === "GET") {
    const internalComments = new Set(
      comments.filter((comment) => comment.isInternal).map((comment) => comment.id),
    );

    const trail = auditLogs
      .filter(
        (entry) =>
          entry.entityId === ticket.id &&
          (isStaff(caller) || entry.action !== "internal_note_added"),
      )
      .filter(
        (entry) =>
          isStaff(caller) || !internalComments.has(entry.newValues?.commentId),
      )
      // A timeline lê do mais antigo para o mais novo, ao contrário da lista.
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

    const page = paginate(trail, url);

    return send(response, 200, { ...page, data: page.data.map(publicAudit) });
  }

  return fail(response, 404, `Cannot ${method} ${pathname}`, "Not Found");
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${PORT}`);
  const { pathname } = url;
  const method = request.method ?? "GET";

  void (async () => {
    const body = await readBody(request);

    if (pathname === "/health") {
      return send(response, 200, { status: "ok" });
    }

    if (pathname === "/__reset" && method === "POST") {
      reset();
      return send(response, 204);
    }

    if (pathname === "/auth/register") {
      // A rota não existe mais: 404 mesmo com token válido.
      return fail(response, 404, "Cannot POST /auth/register", "Not Found");
    }

    if (pathname === "/auth/login" && method === "POST") {
      const domain = String(body.tenantDomain ?? "");
      const company =
        domain === PLATFORM_DOMAIN
          ? { id: PLATFORM_TENANT_ID, isActive: true }
          : companies.find((candidate) => candidate.domain === domain);

      const user = company
        ? users.find(
            (candidate) =>
              candidate.companyId === company.id &&
              candidate.email === body.email &&
              candidate.deletedAt === null,
          )
        : null;

      // Company inexistente, usuário inexistente, senha errada **e company
      // bloqueada** respondem exatamente a mesma coisa. É deliberado: uma
      // empresa suspensa parece um erro de digitação na senha.
      const valid =
        Boolean(company) &&
        company.isActive &&
        Boolean(user) &&
        body.password === PASSWORD;

      return valid
        ? send(response, 200, authResult(user))
        : fail(response, 401, "Invalid credentials", "Unauthorized");
    }

    if (pathname === "/auth/refresh" && method === "POST") {
      const presented = String(body.refreshToken ?? "");
      const ownerId = liveRefreshTokens.get(presented);

      if (!ownerId) {
        // Reuso: quem tinha esse token já o gastou, e daqui não dá para saber
        // qual das duas partes é a legítima. O backend real revoga a família
        // inteira, e é essa consequência que o frontend precisa evitar.
        const suspected = presented.split("-").slice(2).join("-");
        revokeFamily(suspected);
        return fail(response, 401, "Invalid refresh token", "Unauthorized");
      }

      // Rotação: o token apresentado morre aqui.
      liveRefreshTokens.delete(presented);

      const owner = users.find((candidate) => candidate.id === ownerId);
      return send(response, 200, authResult(owner));
    }

    if (pathname === "/auth/logout" && method === "POST") {
      liveRefreshTokens.delete(String(body.refreshToken ?? ""));
      return send(response, 204);
    }

    const caller = authenticated(request);

    if (!caller) {
      // 401 de token: sem a chave `error`, como no backend real.
      return send(response, 401, { message: "Unauthorized", statusCode: 401 });
    }

    if (pathname === "/auth/me" && method === "GET") {
      return send(response, 200, {
        id: caller.id,
        tenantId: caller.companyId,
        email: caller.email,
        role: caller.role,
      });
    }

    const isPlatformRoute = pathname.startsWith("/platform/");
    const operator = caller.role === "ADMIN_MASTER";

    // A guarda vale nos dois sentidos: os papéis não são hierárquicos, então o
    // operador não "também" alcança `/users` — ele é recusado ali.
    if (isPlatformRoute && !operator) {
      return fail(response, 403, "This route requires one of: ADMIN_MASTER", "Forbidden");
    }

    if (pathname.startsWith("/users") && operator) {
      return fail(response, 403, "This route requires one of: ADMIN, AGENT", "Forbidden");
    }

    // --- console do operador -------------------------------------------------

    if (pathname === "/platform/companies" && method === "GET") {
      const search = (url.searchParams.get("search") ?? "").toLowerCase();
      const isActive = url.searchParams.get("isActive");

      const matching = companies.filter(
        (company) =>
          (!search ||
            company.name.toLowerCase().includes(search) ||
            (company.domain ?? "").toLowerCase().includes(search)) &&
          // Ausente significa as duas.
          (isActive === null || company.isActive === (isActive === "true")),
      );

      return send(response, 200, paginate(matching, url));
    }

    if (pathname === "/platform/companies" && method === "POST") {
      if (body.domain === PLATFORM_DOMAIN) {
        return fail(
          response,
          400,
          [`domain "${PLATFORM_DOMAIN}" is reserved for the platform itself`],
          "Bad Request",
        );
      }

      if (!body.admin || !body.admin.email || !body.admin.password) {
        return fail(response, 400, ["admin must be a non-empty object"], "Bad Request");
      }

      if (companies.some((company) => company.domain === body.domain)) {
        return fail(
          response,
          409,
          `The domain "${body.domain}" is already registered`,
          "Conflict",
        );
      }

      nextId += 1;
      const company = {
        id: `66666666-6666-4666-8666-00000000000${nextId}`,
        name: body.name,
        domain: body.domain,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      companies.push(company);

      nextId += 1;
      const admin = {
        id: `77777777-7777-4777-8777-00000000000${nextId}`,
        email: body.admin.email,
        role: "ADMIN",
        companyId: company.id,
        createdAt: new Date().toISOString(),
        deletedAt: null,
      };
      users.push(admin);

      return send(response, 201, { company, admin: publicUser(admin) });
    }

    const companyMatch = /^\/platform\/companies\/([^/]+)(?:\/users(?:\/([^/]+)(\/restore)?)?)?$/.exec(
      pathname,
    );

    if (companyMatch) {
      const [, companyId, userId, restore] = companyMatch;
      const company = companies.find((candidate) => candidate.id === companyId);

      // O tenant da plataforma responde 404 aqui, como qualquer id inexistente.
      if (!company) {
        return fail(response, 404, `No company ${companyId}`, "Not Found");
      }

      const nested = pathname.includes("/users");

      if (!nested) {
        if (method === "GET") {
          return send(response, 200, company);
        }

        if (method === "PATCH") {
          if (
            body.domain !== undefined &&
            companies.some(
              (other) => other.id !== company.id && other.domain === body.domain,
            )
          ) {
            return fail(
              response,
              409,
              `The domain "${body.domain}" is already registered`,
              "Conflict",
            );
          }

          if (body.name !== undefined) company.name = body.name;
          if (body.domain !== undefined) company.domain = body.domain;
          if (body.isActive !== undefined) company.isActive = body.isActive;

          return send(response, 200, company);
        }

        if (method === "DELETE") {
          // Cascade: some com a company e com todo mundo dentro dela.
          companies = companies.filter((candidate) => candidate.id !== company.id);
          users = users.filter((candidate) => candidate.companyId !== company.id);
          return send(response, 204);
        }
      }

      if (nested && !userId) {
        if (method === "GET") {
          return listUsers(response, url, company.id, caller);
        }
        if (method === "POST") {
          return createUser(response, body, company.id);
        }
      }

      if (nested && userId) {
        return mutateUser(response, method, userId, restore, body, company.id, caller);
      }
    }

    // --- helpdesk ------------------------------------------------------------

    if (pathname === "/tickets" || pathname.startsWith("/tickets/")) {
      const handled = handleTickets(response, method, pathname, url, body, caller);

      if (handled !== null) {
        return handled;
      }
    }

    // --- console da empresa --------------------------------------------------

    if (pathname === "/users" && method === "GET") {
      return listUsers(response, url, caller.companyId, caller);
    }

    if (pathname === "/users" && method === "POST") {
      return createUser(response, body, caller.companyId);
    }

    if (pathname === "/users/me/password" && method === "PATCH") {
      if (body.currentPassword !== PASSWORD) {
        return fail(response, 401, "The current password is incorrect", "Unauthorized");
      }

      // Trocar a senha encerra todas as sessões, como no backend real.
      revokeFamily(caller.id);
      return send(response, 204);
    }

    const userMatch = /^\/users\/([^/]+)(\/restore)?$/.exec(pathname);

    if (userMatch) {
      return mutateUser(
        response,
        method,
        userMatch[1],
        userMatch[2],
        body,
        caller.companyId,
        caller,
      );
    }

    return fail(response, 404, `Cannot ${method} ${pathname}`, "Not Found");
  })();
});

server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`fake NexusOps API listening on ${PORT}\n`);
});

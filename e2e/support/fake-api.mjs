/**
 * Dublê do backend NestJS para os testes E2E.
 *
 * Serve os mesmos caminhos, os mesmos códigos e o mesmo envelope de erro
 * descritos em `documents/backend/USERS.md` — inclusive o 409 que aponta o
 * usuário desativado, que é o fluxo mais interessante da tela de usuários.
 *
 * Existe para que `npm run e2e` não dependa de Postgres, Redis e do backend
 * rodando. O que ele **não** substitui é a verificação manual contra a API de
 * verdade, descrita na spec desta fatia.
 */
import { createServer } from "node:http";

const PORT = Number(process.env.FAKE_API_PORT ?? 3101);

const TENANT = { domain: "acme.com", id: "11111111-1111-4111-8111-111111111111" };
const PASSWORD = "correct horse battery";
const ADMIN = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "admin@acme.com",
  role: "ADMIN",
  createdAt: "2026-08-20T10:00:00.000Z",
  deletedAt: null,
};

let users = [];
let nextId = 0;

function reset() {
  users = [
    { ...ADMIN },
    {
      id: "33333333-3333-4333-8333-333333333333",
      email: "agent@acme.com",
      role: "AGENT",
      createdAt: "2026-08-21T10:00:00.000Z",
      deletedAt: null,
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      email: "ghost@acme.com",
      role: "REQUESTER",
      createdAt: "2026-08-22T10:00:00.000Z",
      deletedAt: "2026-08-23T10:00:00.000Z",
    },
  ];
  nextId = 0;
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

function authResult(user) {
  return {
    accessToken: `access-token-for-${user.id}`,
    refreshToken: `refresh-token-for-${user.id}`,
    user,
  };
}

function authenticated(request) {
  const header = request.headers.authorization ?? "";

  return header.startsWith("Bearer access-token-for-") ? ADMIN : null;
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

    if (pathname === "/auth/login" && method === "POST") {
      const valid =
        body.tenantDomain === TENANT.domain &&
        body.email === ADMIN.email &&
        body.password === PASSWORD;

      return valid
        ? send(response, 200, authResult(ADMIN))
        : fail(response, 401, "Invalid credentials", "Unauthorized");
    }

    if (pathname === "/auth/refresh" && method === "POST") {
      return body.refreshToken
        ? send(response, 200, authResult(ADMIN))
        : fail(response, 401, "Invalid refresh token", "Unauthorized");
    }

    if (pathname === "/auth/logout" && method === "POST") {
      return send(response, 204);
    }

    if (!authenticated(request)) {
      return send(response, 401, { message: "Unauthorized", statusCode: 401 });
    }

    if (pathname === "/auth/me" && method === "GET") {
      return send(response, 200, {
        id: ADMIN.id,
        tenantId: TENANT.id,
        email: ADMIN.email,
        role: ADMIN.role,
      });
    }

    if (pathname === "/users" && method === "GET") {
      const includeDeleted = url.searchParams.get("includeDeleted") === "true";
      const role = url.searchParams.get("role");
      const search = (url.searchParams.get("search") ?? "").toLowerCase();
      const page = Number(url.searchParams.get("page") ?? 1);
      const perPage = Number(url.searchParams.get("perPage") ?? 20);

      const matching = users.filter(
        (user) =>
          (includeDeleted || user.deletedAt === null) &&
          (!role || user.role === role) &&
          (!search || user.email.toLowerCase().includes(search)),
      );

      return send(response, 200, {
        data: matching.slice((page - 1) * perPage, page * perPage),
        meta: {
          total: matching.length,
          page,
          perPage,
          totalPages: Math.max(1, Math.ceil(matching.length / perPage)),
        },
      });
    }

    if (pathname === "/users" && method === "POST") {
      const existing = users.find((user) => user.email === body.email);

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
        createdAt: new Date().toISOString(),
        deletedAt: null,
      };
      users.push(created);

      return send(response, 201, created);
    }

    const userMatch = /^\/users\/([^/]+)(\/restore)?$/.exec(pathname);

    if (userMatch) {
      const user = users.find((candidate) => candidate.id === userMatch[1]);

      if (!user) {
        return fail(response, 404, `No user ${userMatch[1]}`, "Not Found");
      }

      if (userMatch[2] && method === "POST") {
        if (user.deletedAt === null) {
          return fail(response, 409, "This user is not deactivated", "Conflict");
        }
        user.deletedAt = null;
        return send(response, 200, user);
      }

      if (method === "PATCH") {
        Object.assign(user, body);
        return send(response, 200, user);
      }

      if (method === "DELETE") {
        if (user.id === ADMIN.id) {
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
    }

    if (pathname === "/users/me/password" && method === "PATCH") {
      return body.currentPassword === PASSWORD
        ? send(response, 204)
        : fail(response, 401, "The current password is incorrect", "Unauthorized");
    }

    return fail(response, 404, `Cannot ${method} ${pathname}`, "Not Found");
  })();
});

server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`fake NexusOps API listening on ${PORT}\n`);
});

import type { ReactElement } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { jsonResponse, parseRequestBody } from "../../../test/http";
import { renderWithQuery } from "../../../test/query-wrapper";
import { UsersScopeProvider } from "../users-scope";
import { UserFormDialog } from "./user-form-dialog";

/**
 * O diálogo não sabe em qual console está: quem diz para onde mutar é o
 * `UsersScope`. Estes casos são os do console da empresa — os mesmos do
 * operador rodariam com `basePath` de company.
 */
function renderDialog(ui: ReactElement) {
  return renderWithQuery(
    <UsersScopeProvider
      scope={{
        basePath: "/api/users",
        queryKeyRoot: ["identity", "users"],
        canManage: true,
        canIncludeDeleted: true,
      }}
    >
      {ui}
    </UsersScopeProvider>,
  );
}

const fetchMock = jest.fn();
const onClose = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  onClose.mockReset();
  globalThis.fetch = fetchMock;
});

const DEACTIVATED_ID = "95e8836c-9c1e-4c1f-93a1-0b0b0d1a2b3c";

function conflict(message: string) {
  return jsonResponse({ message, error: "Conflict", statusCode: 409 }, 409);
}

async function fillNewUser(email = "agent@acme.com", password = "another good one") {
  const user = userEvent.setup();

  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Temporary password"), password);
  await user.click(screen.getByRole("button", { name: "Create user" }));

  return user;
}

describe("UserFormDialog — criação", () => {
  it("cria o usuário com o papel padrão REQUESTER", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "u2" }, 201));

    renderDialog(<UserFormDialog mode={{ type: "create" }} onClose={onClose} />);
    await fillNewUser();

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/users");
    expect(parseRequestBody(init)).toEqual({
      email: "agent@acme.com",
      password: "another good one",
      role: "REQUESTER",
    });
  });

  it("barra senha acima de 72 bytes antes de chamar a API", async () => {
    renderDialog(<UserFormDialog mode={{ type: "create" }} onClose={onClose} />);
    await fillNewUser("agent@acme.com", "🔒".repeat(19));

    expect(await screen.findByRole("alert")).toHaveTextContent("at most 72 bytes");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("oferece restaurar quando o email pertence a um usuário desativado", async () => {
    fetchMock.mockResolvedValueOnce(
      conflict(
        `agent@acme.com belongs to a deactivated user (${DEACTIVATED_ID}). Restore them instead of creating a duplicate.`,
      ),
    );

    renderDialog(<UserFormDialog mode={{ type: "create" }} onClose={onClose} />);
    const user = await fillNewUser();

    const restoreButton = await screen.findByRole("button", {
      name: "Restore this user",
    });

    fetchMock.mockResolvedValueOnce(jsonResponse({ id: DEACTIVATED_ID }));
    await user.click(restoreButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        `/api/users/${DEACTIVATED_ID}/restore`,
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("não oferece restaurar no 409 de email simplesmente em uso", async () => {
    fetchMock.mockResolvedValue(conflict("agent@acme.com is already in use"));

    renderDialog(<UserFormDialog mode={{ type: "create" }} onClose={onClose} />);
    await fillNewUser();

    expect(await screen.findByRole("alert")).toHaveTextContent("already in use");
    expect(
      screen.queryByRole("button", { name: "Restore this user" }),
    ).not.toBeInTheDocument();
  });
});

describe("UserFormDialog — edição", () => {
  const existing = {
    id: "u1",
    email: "agent@acme.com",
    role: "AGENT" as const,
    createdAt: "2026-08-23T13:29:18.546Z",
    deletedAt: null,
  };

  it("não expõe campo de senha: senha alheia não se troca por aqui", () => {
    renderDialog(
      <UserFormDialog mode={{ type: "edit", user: existing }} onClose={onClose} />,
    );

    expect(screen.queryByLabelText("Temporary password")).not.toBeInTheDocument();
  });

  it("manda só email e papel no PATCH", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...existing, email: "new@acme.com" }));

    renderDialog(
      <UserFormDialog mode={{ type: "edit", user: existing }} onClose={onClose} />,
    );

    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Email"));
    await user.type(screen.getByLabelText("Email"), "new@acme.com");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/users/u1");
    expect(init.method).toBe("PATCH");
    expect(parseRequestBody(init)).toEqual({ email: "new@acme.com", role: "AGENT" });
  });
});

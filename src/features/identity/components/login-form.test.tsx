import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { jsonResponse, parseRequestBody } from "../../../test/http";
import { renderWithQuery } from "../../../test/query-wrapper";
import { LoginForm } from "./login-form";

const mockReplace = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), refresh: jest.fn() }),
}));

const fetchMock = jest.fn();

beforeEach(() => {
  mockReplace.mockReset();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
});

async function fillAndSubmit(
  values: { domain?: string; email?: string; password?: string } = {},
) {
  const user = userEvent.setup();

  if (values.domain) {
    await user.type(screen.getByLabelText("Company domain"), values.domain);
  }
  if (values.email) {
    await user.type(screen.getByLabelText("Email"), values.email);
  }
  if (values.password) {
    await user.type(screen.getByLabelText("Password"), values.password);
  }

  await user.click(screen.getByRole("button", { name: "Sign in" }));

  return user;
}

const validCredentials = {
  domain: "acme.com",
  email: "admin@acme.com",
  password: "correct horse battery",
};

describe("LoginForm", () => {
  it("manda tenantDomain, email e senha para o BFF, e navega ao entrar", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ user: { id: "u1", email: "admin@acme.com", role: "ADMIN" } }),
    );

    renderWithQuery(<LoginForm next="/users" />);
    await fillAndSubmit(validCredentials);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/users");
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/auth/login");
    expect(parseRequestBody(init)).toEqual({
      tenantDomain: "acme.com",
      email: "admin@acme.com",
      password: "correct horse battery",
    });
  });

  it("entra como operador com o domínio reservado, sem ninguém digitá-lo", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        user: { id: "op", email: "admin@nexusops.local", role: "ADMIN_MASTER" },
      }),
    );

    renderWithQuery(<LoginForm next="/" />);
    const user = userEvent.setup();

    await user.click(screen.getByLabelText("Sign in as platform operator"));
    await user.type(screen.getByLabelText("Email"), "admin@nexusops.local");
    await user.type(screen.getByLabelText("Password"), "correct horse battery");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(parseRequestBody(init)).toEqual({
      tenantDomain: "platform",
      email: "admin@nexusops.local",
      password: "correct horse battery",
    });

    // E vai para o console dele, não para /users.
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/platform/companies");
    });
  });

  it("trava o campo de domínio ao marcar a caixinha", async () => {
    renderWithQuery(<LoginForm next="/users" />);
    const user = userEvent.setup();

    const field = screen.getByLabelText("Company domain");
    await user.type(field, "acme.com");
    expect(field).toBeEnabled();

    await user.click(screen.getByLabelText("Sign in as platform operator"));

    expect(field).toBeDisabled();
    expect(field).toHaveValue("platform");
  });

  it("devolve o que estava digitado ao desmarcar", async () => {
    renderWithQuery(<LoginForm next="/users" />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Company domain"), "acme.com");
    const checkbox = screen.getByLabelText("Sign in as platform operator");
    await user.click(checkbox);
    await user.click(checkbox);

    const field = screen.getByLabelText("Company domain");
    expect(field).toBeEnabled();
    expect(field).toHaveValue("acme.com");
  });

  it("não exige domínio quando a caixinha está marcada", async () => {
    // O campo está travado: cobrar preenchimento seria cobrar o impossível.
    fetchMock.mockResolvedValue(
      jsonResponse({ message: "Invalid credentials", statusCode: 401 }, 401),
    );

    renderWithQuery(<LoginForm next="/users" />);
    const user = userEvent.setup();

    await user.click(screen.getByLabelText("Sign in as platform operator"));
    await user.type(screen.getByLabelText("Email"), "admin@nexusops.local");
    await user.type(screen.getByLabelText("Password"), "seja o que for");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(screen.queryByText("Company domain is required.")).not.toBeInTheDocument();
  });

  it("exibe a mensagem única do 401 sem sugerir qual campo falhou", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ message: "Invalid credentials", statusCode: 401 }, 401),
    );

    renderWithQuery(<LoginForm next="/users" />);
    await fillAndSubmit(validCredentials);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Invalid credentials");
    expect(alert).not.toHaveTextContent(/password|email|domain/i);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("valida os campos antes de chamar a API", async () => {
    renderWithQuery(<LoginForm next="/users" />);
    await fillAndSubmit();

    expect(await screen.findByText("Company domain is required.")).toBeInTheDocument();
    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("não aplica a política de senha no login — isso denunciaria a conta", async () => {
    // Uma senha curta aqui tem de chegar ao backend e voltar 401, não ser
    // barrada com "mínimo 8 caracteres": a segunda resposta contaria que a
    // conta existe e usa uma senha curta.
    fetchMock.mockResolvedValue(
      jsonResponse({ message: "Invalid credentials", statusCode: 401 }, 401),
    );

    renderWithQuery(<LoginForm next="/users" />);
    await fillAndSubmit({ ...validCredentials, password: "short" });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
  });

  it("alterna a visibilidade da senha", async () => {
    renderWithQuery(<LoginForm next="/users" />);
    const user = userEvent.setup();

    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
  });

  it("desabilita o botão enquanto a requisição corre", async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));

    renderWithQuery(<LoginForm next="/users" />);
    await fillAndSubmit(validCredentials);

    expect(await screen.findByRole("button", { name: /Signing in/ })).toBeDisabled();
  });
});

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { jsonResponse, parseRequestBody } from "../../../test/http";
import { renderWithQuery } from "../../../test/query-wrapper";
import { CompanyFormDialog } from "./company-form-dialog";

const fetchMock = jest.fn();
const onClose = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  onClose.mockReset();
  globalThis.fetch = fetchMock;
});

const created = {
  company: {
    id: "c9",
    name: "Acme Industries",
    domain: "acme.example",
    isActive: true,
    createdAt: "2026-08-25T14:06:01.234Z",
  },
  admin: {
    id: "u9",
    email: "admin@acme.example",
    role: "ADMIN",
    createdAt: "2026-08-25T14:06:01.235Z",
  },
};

async function fillCreate(password = "a-long-enough-password") {
  const user = userEvent.setup();

  await user.type(screen.getByLabelText("Company name"), "Acme Industries");
  await user.type(screen.getByLabelText("Domain"), "acme.example");
  await user.type(screen.getByLabelText("Email"), "admin@acme.example");
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Create company" }));

  return user;
}

describe("criar uma company", () => {
  it("manda company e primeiro administrador no mesmo corpo aninhado", async () => {
    // Uma company sem ADMIN é uma em que ninguém entra: a API não a deixa
    // existir, então são duas seções de um formulário só.
    fetchMock.mockResolvedValue(jsonResponse(created, 201));

    renderWithQuery(<CompanyFormDialog mode={{ type: "create" }} onClose={onClose} />);
    await fillCreate();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(parseRequestBody(init)).toEqual({
      name: "Acme Industries",
      domain: "acme.example",
      admin: { email: "admin@acme.example", password: "a-long-enough-password" },
    });
  });

  it("mostra as credenciais e NÃO fecha sozinho — é a única vez que elas existem", async () => {
    fetchMock.mockResolvedValue(jsonResponse(created, 201));

    renderWithQuery(<CompanyFormDialog mode={{ type: "create" }} onClose={onClose} />);
    const user = await fillCreate();

    expect(await screen.findByText("acme.example")).toBeInTheDocument();
    expect(screen.getByText("a-long-enough-password")).toBeInTheDocument();
    // Não há email de convite nem reset: fechar no sucesso perderia a senha.
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /I've saved these credentials/ }));
    expect(onClose).toHaveBeenCalled();
  });

  it("barra senha acima de 72 bytes antes de chamar a API", async () => {
    // Bytes, não caracteres: o bcrypt trunca no byte 72 e um emoji custa quatro.
    renderWithQuery(<CompanyFormDialog mode={{ type: "create" }} onClose={onClose} />);
    await fillCreate("🔒".repeat(19));

    expect(await screen.findByRole("alert")).toHaveTextContent(/72 bytes/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mostra o 409 de domínio já registrado como veio do backend", async () => {
    const message = 'The domain "acme.example" is already registered';
    fetchMock.mockResolvedValue(
      jsonResponse({ message, error: "Conflict", statusCode: 409 }, 409),
    );

    renderWithQuery(<CompanyFormDialog mode={{ type: "create" }} onClose={onClose} />);
    await fillCreate();

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("editar uma company", () => {
  const company = {
    id: "c1",
    name: "Acme Industries",
    domain: "acme.example",
    isActive: true,
    createdAt: "2026-08-23T13:29:18.546Z",
  };

  it("não pede senha nem administrador", () => {
    renderWithQuery(
      <CompanyFormDialog mode={{ type: "edit", company }} onClose={onClose} />,
    );

    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(screen.queryByText("First administrator")).not.toBeInTheDocument();
  });

  it("manda só nome e domínio — bloquear é outra ação", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...company, name: "Acme Ltd" }));

    renderWithQuery(
      <CompanyFormDialog mode={{ type: "edit", company }} onClose={onClose} />,
    );

    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Company name"));
    await user.type(screen.getByLabelText("Company name"), "Acme Ltd");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(parseRequestBody(init)).toEqual({
      name: "Acme Ltd",
      domain: "acme.example",
    });
  });
});

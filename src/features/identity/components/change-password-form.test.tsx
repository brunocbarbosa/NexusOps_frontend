import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { emptyResponse, jsonResponse } from "../../../test/http";
import { renderWithQuery } from "../../../test/query-wrapper";
import { ChangePasswordForm } from "./change-password-form";

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

async function submit(values: { current?: string; next?: string; confirm?: string }) {
  const user = userEvent.setup();

  if (values.current) {
    await user.type(screen.getByLabelText("Current password"), values.current);
  }
  if (values.next) {
    await user.type(screen.getByLabelText("New password"), values.next);
  }
  if (values.confirm) {
    await user.type(screen.getByLabelText("Confirm new password"), values.confirm);
  }

  await user.click(screen.getByRole("button", { name: "Change password" }));
}

describe("ChangePasswordForm", () => {
  it("troca a senha e desloga na hora — o backend acabou de revogar as sessões", async () => {
    fetchMock.mockResolvedValue(emptyResponse());

    renderWithQuery(<ChangePasswordForm />);
    await submit({ current: "old password", next: "brand new one", confirm: "brand new one" });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/login?reason=password-changed");
    });

    const requested = (fetchMock.mock.calls as [string][]).map(([url]) => url);
    expect(requested).toEqual([
      "/api/account/password",
      "/api/auth/logout",
    ]);
  });

  it("recusa confirmação diferente sem chamar a API", async () => {
    renderWithQuery(<ChangePasswordForm />);
    await submit({ current: "old password", next: "brand new one", confirm: "different" });

    expect(await screen.findByRole("alert")).toHaveTextContent("do not match");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aplica a política de 72 bytes à senha nova", async () => {
    renderWithQuery(<ChangePasswordForm />);
    const long = "🔒".repeat(19);
    await submit({ current: "old password", next: long, confirm: long });

    expect(await screen.findByRole("alert")).toHaveTextContent("at most 72 bytes");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mostra o 401 de senha atual incorreta sem deslogar", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ message: "The current password is incorrect", statusCode: 401 }, 401),
    );

    renderWithQuery(<ChangePasswordForm />);
    await submit({ current: "wrong", next: "brand new one", confirm: "brand new one" });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The current password is incorrect",
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

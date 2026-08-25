import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ThemeToggle } from "./theme-toggle";

beforeEach(() => {
  document.documentElement.classList.remove("dark");
  localStorage.clear();
});

describe("ThemeToggle", () => {
  it("liga o tema escuro na classe do <html> e guarda a escolha", async () => {
    render(<ThemeToggle />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Toggle theme" }));

    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("nexusops-theme")).toBe("dark");
  });

  it("desliga de volta", async () => {
    document.documentElement.classList.add("dark");
    render(<ThemeToggle />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Toggle theme" }));

    expect(document.documentElement).not.toHaveClass("dark");
    expect(localStorage.getItem("nexusops-theme")).toBe("light");
  });
});

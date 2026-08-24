import { test, expect, type Page } from "@playwright/test";

import { fakeApiURL } from "../playwright.config";

/**
 * A fatia de identity ponta a ponta, contra o dublê da API.
 *
 * Serial e com reset: os casos mutam a mesma lista de usuários do stub, e em
 * paralelo um veria o efeito do outro.
 */
test.describe.configure({ mode: "serial" });

const CREDENTIALS = {
  domain: "acme.com",
  email: "admin@acme.com",
  password: "correct horse battery",
};

test.beforeEach(async ({ request }) => {
  await request.post(`${fakeApiURL}/__reset`);
});

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Company domain").fill(CREDENTIALS.domain);
  await page.getByLabel("Email").fill(CREDENTIALS.email);
  await page.getByLabel("Password", { exact: true }).fill(CREDENTIALS.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/users$/);
}

test("senha errada devolve a mesma mensagem, sem dizer qual campo falhou", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Company domain").fill(CREDENTIALS.domain);
  await page.getByLabel("Email").fill(CREDENTIALS.email);
  await page.getByLabel("Password", { exact: true }).fill("wrong password");
  await page.getByRole("button", { name: "Sign in" }).click();

  // O `role="alert"` do anunciador de rotas do Next também casa; o do formulário
  // é o que interessa.
  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "Invalid credentials",
  );
  await expect(page).toHaveURL(/\/login$/);
});

test("login guarda a sessão em cookie httpOnly, invisível ao JavaScript", async ({
  page,
  context,
}) => {
  await signIn(page);

  const cookies = await context.cookies();
  const session = cookies.filter((cookie) => cookie.name.startsWith("nexusops_"));

  expect(session).toHaveLength(2);
  expect(session.every((cookie) => cookie.httpOnly)).toBe(true);

  // O ponto da arquitetura de BFF: nem o token nem o nome dele existem para o
  // JavaScript da página.
  const visible = await page.evaluate(() => document.cookie);
  expect(visible).not.toContain("nexusops_");
});

test("a listagem mostra os usuários ativos e esconde os desativados", async ({
  page,
}) => {
  await signIn(page);

  await expect(page.getByText("admin@acme.com").first()).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "agent@acme.com", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "ghost@acme.com", exact: true }),
  ).toHaveCount(0);

  await page.getByLabel("Show deactivated").click();
  await expect(
    page.getByRole("cell", { name: "ghost@acme.com", exact: true }),
  ).toBeVisible();
});

test("criar um usuário com email de desativado oferece restaurar", async ({ page }) => {
  await signIn(page);

  await page.getByRole("button", { name: "New user" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email").fill("ghost@acme.com");
  await dialog.getByLabel("Temporary password").fill("another good password");
  await dialog.getByRole("button", { name: "Create user" }).click();

  await expect(dialog.getByRole("alert")).toContainText(
    "belongs to a deactivated user",
  );

  await dialog.getByRole("button", { name: "Restore this user" }).click();

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("cell", { name: "ghost@acme.com", exact: true }),
  ).toBeVisible();
});

test("criar e depois desativar um usuário", async ({ page }) => {
  await signIn(page);

  await page.getByRole("button", { name: "New user" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email").fill("new.agent@acme.com");
  await dialog.getByLabel("Temporary password").fill("another good password");
  await dialog.getByRole("button", { name: "Create user" }).click();

  const row = page.getByRole("row", { name: /new\.agent@acme\.com/ });
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: "Actions for new.agent@acme.com" }).click();
  await page.getByRole("menuitem", { name: "Deactivate" }).click();
  await page.getByRole("button", { name: "Deactivate", exact: true }).click();

  await expect(
    page.getByRole("cell", { name: "new.agent@acme.com", exact: true }),
  ).toHaveCount(0);
});

test("o 409 de desativar a si mesmo aparece sem fechar o diálogo", async ({ page }) => {
  await signIn(page);

  const row = page.getByRole("row", { name: /admin@acme\.com/ });
  await row.getByRole("button", { name: "Actions for admin@acme.com" }).click();
  await page.getByRole("menuitem", { name: "Deactivate" }).click();
  await page.getByRole("button", { name: "Deactivate", exact: true }).click();

  await expect(page.getByRole("alertdialog")).toContainText(
    "You cannot deactivate yourself",
  );
});

test("token expirado: cinco requisições concorrentes não derrubam a sessão", async ({
  page,
  context,
}) => {
  // O dublê rotaciona o refresh token e revoga a família inteira em caso de
  // reuso, como o backend real. Sem a janela de tolerância do `refresh.ts`,
  // uma destas cinco passa e as outras quatro tomam 401 — e a sessão morre.
  await signIn(page);

  await context.clearCookies({ name: "nexusops_at" });

  const statuses = await page.evaluate(() =>
    Promise.all(
      Array.from({ length: 5 }, () =>
        fetch("/api/users?page=1&perPage=20").then((response) => response.status),
      ),
    ),
  );

  expect(statuses).toEqual([200, 200, 200, 200, 200]);

  const session = await page.evaluate(() =>
    fetch("/api/auth/me").then((response) => response.status),
  );
  expect(session).toBe(200);
});

test("sair encerra a sessão e volta ao login", async ({ page, context }) => {
  await signIn(page);

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();

  await expect(page).toHaveURL(/\/login$/);
  expect(
    (await context.cookies()).filter((cookie) => cookie.name.startsWith("nexusops_")),
  ).toHaveLength(0);

  // E a rota protegida volta a barrar.
  await page.goto("/users");
  await expect(page).toHaveURL(/\/login/);
});

import { test, expect, type Page } from "@playwright/test";

import { fakeApiURL } from "../playwright.config";

/**
 * O console do operador ponta a ponta, contra o dublê da API.
 *
 * Serial e com reset: os casos mutam as mesmas companies do stub, e em paralelo
 * um veria o efeito do outro.
 */
test.describe.configure({ mode: "serial" });

const OPERATOR = {
  // Sem `domain`: quem preenche o domínio reservado é a caixinha do formulário.
  operator: true,
  email: "admin@nexusops.local",
  password: "correct horse battery",
};

const COMPANY_ADMIN = {
  operator: false,
  domain: "acme.com",
  email: "admin@acme.com",
  password: "correct horse battery",
};

test.beforeEach(async ({ request }) => {
  await request.post(`${fakeApiURL}/__reset`);
});

/**
 * `landing` não é enfeite: o redirecionamento pós-login acontece no cliente,
 * depois da resposta. Sem esperar por ele, o próximo `goto` do caso é
 * atropelado pelo `router.replace` que ainda estava a caminho.
 */
async function signIn(
  page: Page,
  who: { operator: boolean; domain?: string; email: string; password: string },
  landing: RegExp | null = null,
) {
  await page.goto("/login");

  if (who.operator) {
    // O caminho de verdade: marcar trava o campo e manda o domínio reservado.
    await page.getByLabel("Sign in as platform operator").check();
    await expect(page.getByLabel("Company domain")).toBeDisabled();
    await expect(page.getByLabel("Company domain")).toHaveValue("platform");
  } else {
    await page.getByLabel("Company domain").fill(who.domain ?? "");
  }

  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  if (landing) {
    await expect(page).toHaveURL(landing);
  }
}

const PLATFORM_HOME = /\/platform\/companies$/;
const COMPANY_HOME = /\/users$/;

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

test("o operador entra pelo mesmo formulário e cai no console dele", async ({
  page,
}) => {
  await signIn(page, OPERATOR, PLATFORM_HOME);

  // Os papéis não são hierárquicos: ele vê Companies, e não vê Users.
  await expect(page.getByRole("link", { name: "Companies" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);
});

test("quem é de uma company não vê o console do operador", async ({ page }) => {
  await signIn(page, COMPANY_ADMIN, COMPANY_HOME);

  await expect(page.getByRole("link", { name: "Companies" })).toHaveCount(0);
});

test("um ADMIN que chegue em /platform/companies vê o 403 como estado", async ({
  page,
}) => {
  await signIn(page, COMPANY_ADMIN, COMPANY_HOME);
  await page.goto("/platform/companies");

  await expect(
    page.getByText("You don't have access to this page"),
  ).toBeVisible();
});

test("criar uma company mostra as credenciais uma vez e não fecha sozinho", async ({
  page,
}) => {
  await signIn(page, OPERATOR, PLATFORM_HOME);

  await page.getByRole("button", { name: "New company" }).click();
  await page.getByLabel("Company name").fill("Globex");
  // `exact`: a busca da toolbar tem aria-label "Search companies by name or
  // domain", que casaria com um `getByLabel("Domain")` frouxo.
  await page.getByLabel("Domain", { exact: true }).fill("globex.io");
  await page.getByLabel("Email", { exact: true }).fill("admin@globex.io");
  await page.getByLabel("Password", { exact: true }).fill("a-long-enough-password");
  await page.getByRole("button", { name: "Create company" }).click();

  // Não há email de convite nem reset: esta é a única exibição da senha.
  await expect(page.getByText("Globex is ready")).toBeVisible();
  await expect(page.getByText("a-long-enough-password")).toBeVisible();

  await page.getByRole("button", { name: /I've saved these credentials/ }).click();
  await expect(page.getByRole("cell", { name: "Globex", exact: true })).toBeVisible();
});

test("bloquear uma company impede o login de quem é dela", async ({ page }) => {
  // Este é o caso que dá sentido à caixinha: o que importa não é o estado dela
  // mudar, é alguém deixar de conseguir entrar.
  await signIn(page, OPERATOR, PLATFORM_HOME);

  const acme = page.getByRole("row", { name: /Acme Inc/ });
  await acme.getByRole("checkbox", { name: /is active/ }).click();

  await expect(page.getByText("Block this company?")).toBeVisible();
  await page.getByRole("button", { name: "Block" }).click();

  await expect(acme.getByRole("checkbox", { name: /is active/ })).not.toBeChecked();

  await signOut(page);
  await signIn(page, COMPANY_ADMIN);

  // O mesmo 401 genérico de senha errada: uma empresa suspensa é
  // indistinguível de um erro de digitação, e isso é deliberado.
  // `getByText`, e não `getByRole("alert")`: o anunciador de rotas do Next
  // também é um `role="alert"`, e a busca por papel casaria com os dois.
  await expect(page.getByText("Invalid credentials")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("desbloquear devolve o acesso a quem é da company", async ({ page }) => {
  await signIn(page, OPERATOR, PLATFORM_HOME);

  const acme = page.getByRole("row", { name: /Acme Inc/ });
  await acme.getByRole("checkbox", { name: /is active/ }).click();
  await page.getByRole("button", { name: "Block" }).click();
  await expect(acme.getByRole("checkbox", { name: /is active/ })).not.toBeChecked();

  await acme.getByRole("checkbox", { name: /is active/ }).click();
  await expect(page.getByText("Unblock this company?")).toBeVisible();
  await page.getByRole("button", { name: "Unblock" }).click();
  await expect(acme.getByRole("checkbox", { name: /is active/ })).toBeChecked();

  await signOut(page);
  await signIn(page, COMPANY_ADMIN, COMPANY_HOME);
});

test("o operador gerencia os usuários de uma company", async ({ page }) => {
  await signIn(page, OPERATOR, PLATFORM_HOME);

  await page.getByRole("button", { name: "Actions for Acme Inc" }).click();
  await page.getByRole("menuitem", { name: "Manage users" }).click();

  await expect(page).toHaveURL(/\/platform\/companies\/[^/]+\/users$/);
  await expect(page.getByRole("cell", { name: "admin@acme.com", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "New user" }).click();
  // A busca da toolbar tem aria-label "Search users by email".
  await page.getByLabel("Email", { exact: true }).fill("novo@acme.com");
  await page.getByLabel("Temporary password").fill("another good one");
  await page.getByRole("button", { name: "Create user" }).click();

  await expect(page.getByRole("cell", { name: "novo@acme.com", exact: true })).toBeVisible();
});

test("o operador vê e restaura desativados sem ser ADMIN de company", async ({
  page,
}) => {
  await signIn(page, OPERATOR, PLATFORM_HOME);
  await page.getByRole("button", { name: "Actions for Acme Inc" }).click();
  await page.getByRole("menuitem", { name: "Manage users" }).click();
  await expect(page.getByRole("cell", { name: "admin@acme.com", exact: true })).toBeVisible();

  await page.getByLabel("Show deactivated").click();
  await expect(page.getByRole("cell", { name: "ghost@acme.com", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Actions for ghost@acme.com" }).click();
  await page.getByRole("menuitem", { name: "Restore" }).click();
  await page.getByRole("button", { name: "Restore" }).click();

  const ghost = page.getByRole("row", { name: /ghost@acme.com/ });
  await expect(ghost.getByText("Active")).toBeVisible();
});

test("apagar exige digitar o nome, e oferece bloquear no caminho", async ({
  page,
}) => {
  await signIn(page, OPERATOR, PLATFORM_HOME);

  await page.getByRole("button", { name: "Actions for Acme Inc" }).click();
  await page.getByRole("menuitem", { name: /Delete permanently/ }).click();

  const confirm = page.getByRole("button", { name: "Delete permanently" });
  await expect(confirm).toBeDisabled();

  await page.getByLabel(/Type/).fill("Acme");
  await expect(confirm).toBeDisabled();

  await page.getByLabel(/Type/).fill("Acme Inc");
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect(page.getByRole("cell", { name: "Acme Inc", exact: true })).toHaveCount(0);
  await expect(page.getByText("No companies match these filters.")).toBeVisible();
});

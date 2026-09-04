import { test, expect, type Browser, type Page } from "@playwright/test";

import { fakeApiURL } from "../playwright.config";

/**
 * O helpdesk ponta a ponta, contra o dublê da API.
 *
 * Serial e com reset: os casos abrem chamados no mesmo stub, e em paralelo um
 * veria os do outro.
 */
test.describe.configure({ mode: "serial" });

const PASSWORD = "correct horse battery";
const DOMAIN = "acme.com";

const REQUESTER = "req@acme.com";
const OTHER_REQUESTER = "other@acme.com";
const AGENT = "agent@acme.com";

test.beforeEach(async ({ request }) => {
  await request.post(`${fakeApiURL}/__reset`);
});

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Company domain").fill(DOMAIN);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/tickets$/);
}

/** Uma sessão independente: cookies próprios, como uma segunda máquina. */
async function signInFresh(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, email);

  return page;
}

async function openTicket(page: Page, title: string) {
  await page.getByRole("button", { name: "New ticket" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByRole("button", { name: "Open ticket" }).click();
  await expect(page).toHaveURL(/\/tickets\/[^/]+$/);
}

test("um requester abre um chamado e cai direto nele", async ({ page }) => {
  await signIn(page, REQUESTER);
  await openTicket(page, "Printer on the 3rd floor is jammed");

  await expect(page.getByRole("heading", { name: "Printer on the 3rd floor is jammed" })).toBeVisible();
  // O número é o que uma pessoa fala em voz alta, e recomeça em 1 na company.
  await expect(page.getByText("#1")).toBeVisible();
  await expect(page.getByText("opened this ticket")).toBeVisible();
});

test("um requester não enxerga o chamado do colega de sala", async ({ page, browser }) => {
  const other = await signInFresh(browser, OTHER_REQUESTER);
  await openTicket(other, "My laptop will not charge");
  const url = other.url();
  await other.context().close();

  await signIn(page, REQUESTER);
  await page.goto(url);

  // 404, e a tela diz "não encontrado" em vez de um alerta de erro: é a regra
  // de visibilidade, não uma falha do sistema.
  await expect(page.getByRole("heading", { name: "Ticket not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to all tickets" })).toBeVisible();
});

test("um agente vê o chamado de qualquer um, assume e move o status", async ({
  page,
  browser,
}) => {
  const requester = await signInFresh(browser, REQUESTER);
  await openTicket(requester, "Printer jammed");
  const url = requester.url();
  await requester.context().close();

  await signIn(page, AGENT);
  await page.goto(url);

  await page.getByRole("combobox", { name: "Assignee" }).click();
  await page.getByRole("option", { name: AGENT }).click();
  await expect(page.getByText(`assigned this to ${AGENT}`)).toBeVisible();

  await page.getByRole("button", { name: "Start work" }).click();
  await expect(page.getByText("moved this from Open to In progress")).toBeVisible();
});

test("uma transição ilegal vira alerta inline, não diálogo", async ({ page }) => {
  await signIn(page, AGENT);
  await openTicket(page, "Fixed itself");

  await page.getByRole("button", { name: "Resolve right away" }).click();
  await expect(page.getByRole("button", { name: "Close" })).toBeVisible();

  // RESOLVED não volta para IN_PROGRESS: o botão nem existe, porque o backend
  // recusaria com 409 e um botão que sempre falha é pior que nenhum.
  await expect(page.getByRole("button", { name: "Start work" })).toHaveCount(0);
});

test("a nota interna não chega ao requester, nem na thread nem na trilha", async ({
  browser,
}) => {
  const requester = await signInFresh(browser, REQUESTER);
  await openTicket(requester, "Printer jammed");
  const url = requester.url();

  const agent = await signInFresh(browser, AGENT);
  await agent.goto(url);
  await agent.getByLabel("Add a comment").fill("Vendor said friday.");
  await agent.getByLabel(/Internal note/).click();
  await agent.getByRole("button", { name: "Add note" }).click();
  await expect(agent.getByText("Vendor said friday.")).toBeVisible();
  await agent.context().close();

  await requester.reload();
  await expect(requester.getByText("opened this ticket")).toBeVisible();
  await expect(requester.getByText("Vendor said friday.")).toHaveCount(0);
  await expect(requester.getByText("left an internal note")).toHaveCount(0);
  await requester.context().close();
});

test("um chamado fechado fica legível e recusa comentário novo", async ({ page }) => {
  await signIn(page, AGENT);
  await openTicket(page, "Printer jammed");

  await page.getByLabel("Add a comment").fill("Replaced the roller.");
  await page.getByRole("button", { name: "Comment", exact: true }).click();
  await expect(page.getByText("Replaced the roller.")).toBeVisible();

  await page.getByRole("button", { name: "Resolve right away" }).click();
  await page.getByRole("button", { name: "Close" }).click();

  await expect(page.getByText("Closed is final. Open a new ticket if it comes back.")).toBeVisible();
  await expect(page.getByText(/takes no new comments/)).toBeVisible();
  // Frozen, não hidden: a thread continua lá.
  await expect(page.getByText("Replaced the roller.")).toBeVisible();
});

test("duas edições concorrentes: o segundo recebe o diálogo, reaplica e a versão anda", async ({
  page,
  browser,
}) => {
  await signIn(page, AGENT);
  await openTicket(page, "Printer jammed");
  const url = page.url();

  // Uma segunda sessão carrega o mesmo chamado na mesma versão.
  const second = await signInFresh(browser, AGENT);
  await second.goto(url);
  await expect(second.getByRole("heading", { name: "Printer jammed" })).toBeVisible();

  // A primeira salva. A partir daqui a segunda está uma versão atrás e não sabe.
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Description").fill("It jams on every duplex job.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("It jams on every duplex job.")).toBeVisible();

  await second.getByRole("button", { name: "Edit" }).click();
  await second.getByLabel("Description").fill("Only on the third tray.");
  await second.getByRole("button", { name: "Save" }).click();

  const dialog = second.getByRole("dialog");
  await expect(dialog.getByText("Someone else changed this ticket")).toBeVisible();
  await expect(dialog.getByText(/version 1/)).toBeVisible();
  await expect(dialog.getByText(/version 2/)).toBeVisible();
  // Os dois lados: o que está no servidor e o que se tentou salvar.
  await expect(dialog.getByText("It jams on every duplex job.")).toBeVisible();
  await expect(dialog.getByText("Only on the third tray.")).toBeVisible();

  await dialog.getByRole("button", { name: "Reapply mine" }).click();
  await expect(second.getByRole("dialog")).toHaveCount(0);
  await expect(second.getByText("Only on the third tray.")).toBeVisible();

  // E a primeira, ao recarregar, vê o que a segunda reaplicou.
  await page.reload();
  await expect(page.getByText("Only on the third tray.")).toBeVisible();
  await second.context().close();
});

test("os filtros da lista chegam ao backend sem se contradizerem", async ({ page }) => {
  await signIn(page, AGENT);
  await openTicket(page, "Printer jammed");
  await page.getByRole("link", { name: "All tickets" }).click();

  await expect(page.getByText("1 ticket")).toBeVisible();

  await page.getByRole("combobox", { name: "Filter by assignee" }).click();
  await page.getByRole("option", { name: "Unassigned" }).click();
  await expect(page.getByText("Printer jammed")).toBeVisible();

  await page.getByRole("combobox", { name: "Filter by status" }).click();
  await page.getByRole("option", { name: "Resolved" }).click();
  await expect(page.getByText("No tickets match these filters.")).toBeVisible();
});

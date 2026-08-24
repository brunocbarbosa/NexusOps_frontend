import { test, expect } from "@playwright/test";

/**
 * Fumaça do artefato: prova que o standalone sobe, protege as rotas e serve a
 * página completa. Os fluxos de produto estão em `identity.spec.ts`.
 */
test("quem chega sem sessão cai no login", async ({ page }) => {
  await page.goto("/users");

  await expect(page).toHaveURL(/\/login\?next=%2Fusers$/);
  await expect(page.getByRole("heading", { name: "NexusOps" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("os estáticos são servidos junto com o HTML", async ({ page }) => {
  // O build standalone não copia .next/static sozinho. Sem os estáticos o
  // servidor ainda responde 200 e o texto aparece — só o CSS some. Asserção
  // sobre estilo computado é o que separa "respondeu" de "funcionou".
  const falhas: string[] = [];
  page.on("response", (r) => {
    if (!r.ok() && new URL(r.url()).pathname.startsWith("/_next/")) {
      falhas.push(`${r.status()} ${r.url()}`);
    }
  });

  await page.goto("/login");

  const heading = page.getByRole("heading", { name: "NexusOps" });
  const fontSize = await heading.evaluate((el) => getComputedStyle(el).fontSize);

  // text-2xl do Tailwind. Sem CSS, o h1 cairia no padrão do browser (32px).
  expect(fontSize).toBe("24px");
  expect(falhas).toEqual([]);
});

test("os cabeçalhos de segurança acompanham a resposta", async ({ page }) => {
  const response = await page.goto("/login");

  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response?.headers()["x-frame-options"]).toBe("DENY");
});

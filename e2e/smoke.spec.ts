import { test, expect } from "@playwright/test";

/**
 * Fumaça do scaffold: prova que o artefato standalone sobe e serve a página
 * completa. Os fluxos críticos de verdade — login com tenantDomain, abertura
 * de chamado, conflito 409 — chegam com as features.
 */
test("o artefato standalone serve a página inicial", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "NexusOps" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Componente shadcn" }),
  ).toBeVisible();
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

  await page.goto("/");

  const heading = page.getByRole("heading", { name: "NexusOps" });
  const fontSize = await heading.evaluate(
    (el) => getComputedStyle(el).fontSize,
  );

  // text-3xl do Tailwind. Sem CSS, o h1 cairia no padrão do browser (32px).
  expect(fontSize).toBe("30px");
  expect(falhas).toEqual([]);
});

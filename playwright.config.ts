import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,

  // Impede que `test.only` esquecido num commit passe verde na CI mascarando
  // o resto da suíte.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL,
    trace: "on-first-retry",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  // Roda contra o artefato standalone — o mesmo que a imagem Docker executa —
  // e nunca contra `next dev`, que compila sob demanda e transforma variação de
  // tempo em flakiness na CI. `next start` também não serve: é incompatível com
  // output standalone e leria de .next/, mascarando estáticos faltando.
  // Porta própria para não colidir com um `dev` aberto.
  webServer: {
    command: `PORT=${PORT} npm run start:standalone`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

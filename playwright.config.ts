import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const API_PORT = 3101;
const baseURL = `http://127.0.0.1:${PORT}`;

export const fakeApiURL = `http://127.0.0.1:${API_PORT}`;

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

  webServer: [
    // Dublê do NestJS. Sem ele o E2E precisaria de Postgres, Redis e do
    // backend rodando para exercitar uma tela de login.
    {
      command: `FAKE_API_PORT=${API_PORT} node e2e/support/fake-api.mjs`,
      url: `${fakeApiURL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    // Roda contra o artefato standalone — o mesmo que a imagem Docker executa —
    // e nunca contra `next dev`, que compila sob demanda e transforma variação de
    // tempo em flakiness na CI. `next start` também não serve: é incompatível com
    // output standalone e leria de .next/, mascarando estáticos faltando.
    // Porta própria para não colidir com um `dev` aberto.
    {
      command: `PORT=${PORT} npm run start:standalone`,
      url: baseURL,
      env: { NEXUSOPS_API_URL: fakeApiURL },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});

import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const API_PORT = 3101;
const baseURL = `http://127.0.0.1:${PORT}`;

export const fakeApiURL = `http://127.0.0.1:${API_PORT}`;

export default defineConfig({
  testDir: "./e2e",

  // **Um worker, sempre.** O dublê da API é um único processo com estado global
  // em memória, e todo spec que o muta começa com `POST /__reset`. Dois
  // arquivos em paralelo se atropelam: o reset de um apaga a sessão que o outro
  // acabou de abrir, e a falha aparece como um login que "não redirecionou".
  // Custou uma investigação; a suíte inteira roda em segundos de qualquer jeito.
  fullyParallel: false,

  // Impede que `test.only` esquecido num commit passe verde na CI mascarando
  // o resto da suíte.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
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

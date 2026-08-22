import type { Config } from "jest";
import nextJest from "next/jest.js";

// next/jest cuida da transformação (SWC), do carregamento de .env, do alias
// @/* vindo do tsconfig e do CSS Modules. Escrever a transform à mão aqui
// duplicaria configuração que o Next já mantém alinhada com o build.
const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  coverageProvider: "v8",
  // O que o SonarCloud mede. Sem a lista, o Jest só reporta cobertura dos
  // arquivos que algum teste importou — um arquivo sem teste nenhum some do
  // relatório em vez de aparecer com 0%, que é justamente o que interessa ver.
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.test.{ts,tsx}",
    "!src/test/**",
  ],
  // `lcov` hoje é default do Jest, mas o gate do Sonar depende do arquivo
  // coverage/lcov.info existir. Declarar explicitamente impede que uma troca
  // de default numa versão futura desligue a cobertura em silêncio.
  coverageReporters: ["text-summary", "lcov"],
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/src/test/setup.ts"],
  // O build standalone copia um package.json para .next/, e o haste map do
  // Jest o vê como um segundo módulo de mesmo nome. Sem isto, todo `npm test`
  // após um build imprime aviso de colisão.
  modulePathIgnorePatterns: ["<rootDir>/.next/"],
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/.next/",
    // e2e/ é do Playwright: rodar spec de browser dentro do jsdom trava.
    "<rootDir>/e2e/",
  ],
};

export default createJestConfig(config);

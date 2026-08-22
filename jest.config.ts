import type { Config } from "jest";
import nextJest from "next/jest.js";

// next/jest cuida da transformação (SWC), do carregamento de .env, do alias
// @/* vindo do tsconfig e do CSS Modules. Escrever a transform à mão aqui
// duplicaria configuração que o Next já mantém alinhada com o build.
const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  coverageProvider: "v8",
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

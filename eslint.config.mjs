import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Regras que exigem informação de tipo. São a razão de o TypeScript estar
  // fixado em 6.0.3: o typescript-eslint declara peer `<6.1.0`, e sem ele
  // dentro do range estas regras simplesmente não rodam.
  //
  // Só se aplicam a src/ e e2e/ — arquivos de config na raiz ficam fora do
  // `project`, e incluí-los faria o parser falhar.
  {
    files: ["src/**/*.ts", "src/**/*.tsx", "e2e/**/*.ts"],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Promise não aguardada é a falha silenciosa mais cara num cliente de
      // API: a mutation falha, ninguém trata, a UI segue como se tivesse dado
      // certo. Erro, não aviso.
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",

      // `any` que entra pela fronteira da API contamina tudo a jusante.
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-return": "error",

      // Variável não usada com prefixo _ é intencional (ex.: descarte de
      // parâmetro em callback).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // O Next reescreve este arquivo; não é código nosso para lintar.
    "AGENTS.md",
  ]),
]);

export default eslintConfig;

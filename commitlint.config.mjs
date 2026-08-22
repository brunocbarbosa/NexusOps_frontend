/**
 * Conventional Commits. O histórico do repositório já segue este formato
 * (`docs:`, `feat:`, `chore:`), e o Commitlint passa a exigi-lo.
 */
const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // O corpo dos commits deste projeto carrega o porquê das decisões, com
    // parágrafos quebrados a ~80. O padrão de 100 caracteres serve.
    "body-max-line-length": [2, "always", 100],
  },
};

export default config;

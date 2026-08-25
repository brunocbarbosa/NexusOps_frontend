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
  ignores: [
    // O Dependabot escreve a própria mensagem e não deixa configurá-la além do
    // prefixo: o `Bump` maiúsculo reprova em `subject-case` e o changelog que
    // ele cola no corpo estoura as 100 colunas. Sem esta exceção, todo PR do
    // bot nasce com o job `commits` vermelho — e `commits` é required check na
    // `development`, então nenhum deles seria mergeável.
    //
    // A exceção é deliberadamente estreita: casa só o formato exato que o bot
    // emite, e mora aqui em vez de num `if:` que pula o job, porque um job
    // pulado conta como verde no ruleset e some com o gate inteiro.
    (message) => /^chore\(deps(-dev)?\): Bump /.test(message),
  ],
};

export default config;

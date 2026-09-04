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
    // prefixo: o changelog que ele cola no corpo estoura as 100 colunas. Sem
    // esta exceção, todo PR do bot nasce com o job `commits` vermelho — e
    // `commits` é required check na `development`, então nenhum deles seria
    // mergeável.
    //
    // O verbo casa em maiúscula E minúscula porque o bot já emitiu os dois: os
    // PRs até #21 vieram com `Bump`, e os de 2026-08-31 em diante (#22 a #27)
    // com `bump`. A regex antiga exigia a maiúscula, então parou de casar da
    // noite para o dia e os cinco PRs abertos travaram em `body-max-line-length`
    // sem que nada neste repositório tivesse mudado. O verbo é do bot, não
    // nosso: não vale ancorar a capitalização dele.
    //
    // `ci(deps)` entra junto porque é o prefixo que o `.github/dependabot.yml`
    // dá ao ecossistema `github-actions` — a primeira atualização de action
    // cairia na mesma armadilha.
    //
    // A exceção continua estreita: casa só os formatos que o bot emite, e mora
    // aqui em vez de num `if:` que pula o job, porque um job pulado conta como
    // verde no ruleset e some com o gate inteiro.
    (message) => /^(chore|ci)\(deps(-dev)?\): [Bb]ump /.test(message),
  ],
};

export default config;

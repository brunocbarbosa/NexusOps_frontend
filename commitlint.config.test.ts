/**
 * A exceção do Dependabot no `commitlint.config.mjs` quebrou em silêncio quando
 * o bot trocou `Bump` por `bump`: nada neste repositório mudou, e mesmo assim
 * os cinco PRs abertos travaram no job `commits`. Este teste prende as
 * mensagens **reais** que o bot emitiu — as de antes e as de depois da troca —
 * para que a próxima variação apareça aqui, e não num PR vermelho.
 */
import config from "./commitlint.config.mjs";

const isIgnored = (message: string) =>
  (config.ignores as ((message: string) => boolean)[]).some((rule) => rule(message));

describe("a exceção do Dependabot", () => {
  // Colhidas de `git log` nas branches dos PRs #22 a #27 e do histórico anterior.
  it.each([
    "chore(deps-dev): bump @types/react-dom in the react group",
    "chore(deps): bump the next group with 2 updates",
    "chore(deps): bump the tanstack group with 3 updates",
    "chore(deps-dev): bump @testing-library/react in the testing group",
    "chore(deps-dev): bump typescript-eslint in the linting group",
    "chore(deps): bump fast-uri from 3.1.5 to 3.1.7",
    "chore(deps): Bump the tanstack group with 2 updates",
    "chore(deps-dev): Bump eslint from 9.39.4 to 9.39.5",
    // O ecossistema `github-actions` usa o prefixo `ci`, por dependabot.yml.
    "ci(deps): bump the actions group with 3 updates",
  ])("ignora %s", (message) => {
    expect(isIgnored(message)).toBe(true);
  });

  // A exceção existe para o bot. Alargá-la até engolir commit humano
  // desligaria o gate sem ninguém perceber.
  it.each([
    "chore: bump a versão do pacote",
    "feat(deps): bump the next group with 2 updates",
    "chore(helpdesk): bumpa o contador",
    "fix(deps): bump algo",
  ])("não ignora %s", (message) => {
    expect(isIgnored(message)).toBe(false);
  });
});

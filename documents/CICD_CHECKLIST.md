# Checklist — CI/CD, testes e segurança

Rastreia a execução da spec [`specs/2026-08-22-cicd-security-design.md`](./specs/2026-08-22-cicd-security-design.md).
Uma tarefa só é marcada depois da verificação passar — não depois do comando rodar.

**Legenda:** `[ ]` pendente · `[x]` concluída e verificada · `[!]` bloqueada (motivo ao lado)

---

## Camada 1 — Preparação do repositório

- [x] `.nvmrc` com Node 24 (fonte única para `setup-node` e Dockerfile)
- [x] Script `typecheck`
- [x] `collectCoverageFrom` e `coverageReporters` no Jest
- [x] `public/` versionado (o `COPY` do Dockerfile falha sem ele)
- [x] `coverage/`, `test-results/`, `playwright-report/`, `.scannerwork/` ignorados no git e no ESLint
- [x] `test-results/.last-run.json` removido do versionamento
- [x] **Verificar:** `npm run typecheck` limpo
- [x] **Verificar:** `npm run test:coverage` gera `coverage/lcov.info` com caminhos relativos
- [x] **Verificar:** `npm run lint` limpo **depois** de rodar a cobertura
- [x] Commit

## Camada 2 — Workflow de CI

- [x] `branch-policy` — reprova PR para `main` que não venha de `development`
- [x] `commits` — commitlint sobre o intervalo do PR
- [x] `quality` — lint, typecheck, unidade com cobertura, artefato `lcov.info`
- [x] `e2e` — build + Playwright, relatório como artefato em falha
- [x] `sonar` — scan + Quality Gate bloqueante, `fetch-depth: 0`
- [x] `sonar-project.properties` sem `organization`/`projectKey` (vêm das variables)
- [x] **Verificar:** `actionlint` limpo
- [x] Commit
- [!] **Verificar na CI:** PR #1 — `branch-policy`, `commits`, `quality` e `e2e` verdes.
      `sonar` fica *skipping* até o secret e as variables existirem neste repositório (ver Passos
      manuais no GitHub).
- [x] **Verificar na CI:** PR #2 (rascunho, aberto e fechado) — `branch-policy` reprovou com
      `main so recebe PR vindo de development (este veio de 'ci/pipeline-cicd-security')`

## Camada 3 — Segurança

- [x] `codeql` — `javascript-typescript`, `build-mode: none`, `security-extended`
- [x] `dependency-review` — `fail-on-severity: high`, licenças GPL negadas
- [x] `audit` — produção bloqueante, completo informativo
- [x] `secrets` — gitleaks com histórico completo
- [x] `schedule` semanal (CVE aparece sem commit)
- [x] `dependabot.yml` com **`target-branch: development`**
- [x] `SECURITY.md`
- [x] **Verificar:** `actionlint` limpo
- [x] **Verificar:** `npm audit` nas duas passadas → 0 vulnerabilidades
- [x] Commit
- [!] **Verificar na CI:** PR #1 — `codeql`, `audit` e `secrets` verdes.
      `dependency-review` falha até o Dependency graph ser ligado (ver Passos manuais no GitHub).

## Camada 4 — Docker e release

- [x] `Dockerfile` multi-stage, não-root, `.next/static` copiado à mão
- [x] `.dockerignore`
- [x] `src/app/api/health/route.ts` (ampliação de escopo — ver §4 da spec)
- [x] `release.yml` para o GHCR, com attestation de proveniência
- [x] Nome da imagem normalizado para minúsculo
- [x] **Verificar:** `docker build` conclui (67 MB)
- [x] **Verificar:** `/api/health` responde `{"status":"ok"}`
- [x] **Verificar:** o CSS referenciado no HTML responde **200**, não 404
- [x] **Verificar:** `id` no container reporta `nextjs`, não root
- [x] **Verificar:** `HEALTHCHECK` chega a `healthy`
- [x] Commit
- [ ] **Verificar na CI:** imagem publicada no GHCR após merge em `main`

## Camada 5 — Política de branches

- [x] `scripts/setup-branch-rulesets.sh` idempotente, simulação por padrão
- [x] `pull_request_template.md`
- [x] `CODEOWNERS`
- [x] **Verificar:** `bash -n` limpo e simulação emite JSON válido para os dois rulesets
- [x] Commit
- [ ] **Aplicar:** `bash scripts/setup-branch-rulesets.sh --apply`
- [ ] **Verificar:** `gh api repos/.../branches/main/protection` deixa de responder 404

## Camada 6 — Documentação

- [x] Spec `specs/2026-08-22-cicd-security-design.md`
- [x] Este checklist
- [x] `CLAUDE.md` atualizado
- [x] `README.md` atualizado
- [x] Commit

---

## Passos manuais no GitHub

Descobertos rodando o PR #1. Nenhum é automatizável pelo repositório, e os dois deixam um check
vermelho ou enganosamente verde até serem feitos.

- [ ] **Criar o secret e as variables NESTE repositório.** Medido em 2026-08-22:
      `gh api repos/brunocbarbosa/NexusOps_frontend/actions/variables` devolve `total_count: 0`.
      Os quatro existem, mas em **`NexusOps_backend`**, com
      `SONAR_PROJECT_KEY=brunocbarbosa_NexusOps_backend`. Secret e variables não são herdados entre
      repositórios de uma conta pessoal.

      ```bash
      gh variable set SONAR_ENABLED      --repo brunocbarbosa/NexusOps_frontend --body 'true'
      gh variable set SONAR_ORGANIZATION --repo brunocbarbosa/NexusOps_frontend --body 'brunocbarbosa'
      gh variable set SONAR_PROJECT_KEY  --repo brunocbarbosa/NexusOps_frontend --body 'brunocbarbosa_NexusOps_frontend'
      gh secret   set SONAR_TOKEN        --repo brunocbarbosa/NexusOps_frontend   # pede o valor
      ```

      > **Cuidado:** um job pulado por `if` reporta conclusão *skipped*, e o GitHub conta *skipped*
      > como satisfeito num check obrigatório. Sem `SONAR_ENABLED=true`, o check `sonar` passa **sem
      > analisar nada** — verde por ausência, não por qualidade.

- [ ] **Ligar o Dependency graph.** Medido: o job `dependency-review` falha com
      `Dependency review is not supported on this repository`, e
      `repos/.../vulnerability-alerts` responde 404 (*Vulnerability alerts are disabled*).

      ```bash
      gh api --method PUT repos/brunocbarbosa/NexusOps_frontend/vulnerability-alerts
      gh api --method PUT repos/brunocbarbosa/NexusOps_frontend/automated-security-fixes
      ```

      O primeiro liga o grafo de dependências e os alertas do Dependabot; o segundo liga as
      correções automáticas de segurança. O `dependabot.yml` deste PR cuida das atualizações de
      versão, que são independentes disso.

---

## Passos manuais no SonarCloud

Nenhum é automatizável, e cada um falha de um jeito que não se parece com a causa.

- [ ] **Desligar Automatic Analysis** em *Administration → Analysis Method*.
      Com ela ligada, o job `sonar` morre com `You are running CI analysis while Automatic Analysis
      is enabled`. É o erro mais provável na primeira execução.
- [ ] **Instalar/autorizar o GitHub App do SonarCloud** no repositório, para a decoração do PR.
      O gate já bloqueia sem ele (o passo `sonarqube-quality-gate-action` é quem reprova), mas os
      comentários no PR não aparecem.
- [ ] **Conferir a New Code definition** do projeto.
- [!] **Marcar `development` como branch de vida longa.** Medido no primeiro scan de branch: o
      scanner logou `Branch name: development, type: short` e o passo do Quality Gate falhou com
      `curl: (22) The requested URL returned error: 403` — branch `SHORT` não tem gate para
      consultar, e o erro não se parece com a causa.

      O padrão herdado da instância é `(branch|release)-.*`, que `development` não casa. Em
      *Administration → Branches & Pull Requests* do projeto, trocar por:

      ```
      (development|branch|release)-?.*
      ```

      Depois **apagar a branch `development`** na mesma tela: trocar o padrão não reclassifica uma
      branch já analisada. O `main` já está correto (`LONG`, `isMain`).

      > A análise de **PR** não é afetada — ela passou verde no PR #1. O que quebra é só o scan do
      > push em `development`.

---

## Registro de desvios

Divergências entre o que a spec previu e o que a execução exigiu.

| Data | Camada | Desvio | Motivo |
| --- | --- | --- | --- |
| 2026-08-22 | 1 | `eslint.config.mjs` passou a ignorar `coverage/`, `test-results/`, `playwright-report/` e `.scannerwork/` — não estava na spec | Descoberto ao rodar `npm run lint` depois de `npm run test:coverage`: o ESLint lintava o relatório HTML do Istanbul e reprovava com *Unused eslint-disable directive* em JS de terceiros. O resultado do lint dependia de qual comando tinha rodado antes — ordem que difere entre máquina e CI. |
| 2026-08-22 | 1 | `test-results/.last-run.json` removido do versionamento | Artefato do Playwright commitado por engano na camada 5 do scaffold. A CI passa a subi-lo como artefato de execução. |
| 2026-08-22 | 4 | `actions/attest-build-provenance@v4`, não v3 | v4.2.2 é a release atual; v3 não é mais mantida. |
| 2026-08-22 | 4 | `actions/download-artifact@v8`, não v7 | O `download-artifact` não acompanha o `upload-artifact` em lockstep: v8.0.1 contra v7.0.1. |
| 2026-08-22 | 5 | `dependency-review` **fora** dos checks obrigatórios do ruleset | Só roda em evento de `pull_request`. Como check obrigatório, deixaria todo push de merge pendente para sempre. |
| 2026-08-22 | 1 | `typecheck` virou `next typegen && tsc --noEmit`, não só `tsc --noEmit` | Falhou no PR #1 com `TS2304: Cannot find name 'LayoutProps'`. O tipo é gerado pelo Next em `.next/types`, e `next-env.d.ts` é ignorado no git: na máquina os dois existem porque `dev`/`build` já rodaram, num clone limpo não. O script dependia em silêncio de um build que ninguém pediu. |
| 2026-08-22 | 3 | Dependency graph precisou ser ligado à mão | Não vinha ligado neste repositório, apesar de público. O job falha com `Dependency review is not supported on this repository` até isso ser feito. |
| 2026-08-22 | 2 | Secret e variables do Sonar não estavam neste repositório | Estavam em `NexusOps_backend`, com a chave de projeto do backend. Descoberto porque o job `sonar` apareceu como *skipping* no PR #1. |
| 2026-08-22 | 2 | `sonar.sources` passou a incluir `Dockerfile`, `.github` e `scripts` | Com `sonar.sources=src`, o scanner logou "no files to be analyzed" para Docker, GitHub Actions e Shell: a pipeline estava fora da análise de qualidade que ela própria executa. |
| 2026-08-22 | 2 | Actions de terceiros fixadas em SHA de commit | O Quality Gate reprovou com `new_security_rating=3`, apontando `githubactions:S7637` em 8 lugares. Tag é ponteiro móvel: quem controla o repositório da action pode reapontar `v6` para outro código. Actions do `actions/*` e `github/*` seguem em tag major — são de propriedade do GitHub e a própria regra as isenta. |
| 2026-08-22 | 1, 4 | `npm ci --ignore-scripts` na CI e no Dockerfile | `S6505`: um `postinstall` de dependência transitiva roda com rede e FS do build. Verificado num clone limpo que lint, typecheck, testes e build passam sem os scripts — o único pacote da árvore com `postinstall` é o `unrs-resolver`, e o ESLint funciona sem ele. |
| 2026-08-22 | 2 | `permissions` movido do topo do workflow para cada job | `S8264`: o escopo herdado do topo é maior do que o de que cada job precisa. |
| 2026-08-22 | 2 | `npx playwright install` virou `npm exec --no -- playwright install` | `S6505`/`S8543`: o `npx` baixa e executa pacote da rede quando não o encontra local. `--no` falha em vez de baixar, e a versão do browser passa a vir do pacote já instalado. |
| 2026-08-22 | 2 | O gate reprova no push em `development` até o SonarCloud reclassificar a branch | Não previsto na spec. O default da instância trata `development` como branch de vida curta, e branch curta não tem Quality Gate. Ver "Passos manuais no SonarCloud". |

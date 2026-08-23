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
- [x] **Verificar na CI:** os cinco jobs verdes no PR #5, com o Quality Gate lido de verdade
      (`HTTP 200`, status `OK`). No PR #1 o `sonar` ainda ficava *skipping* por falta do secret.
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
- [x] **Verificar na CI:** os quatro jobs verdes no PR #5. No PR #1 o `dependency-review` falhava
      por o Dependency graph estar desligado no repositório.

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
- [x] **Aplicar:** `bash scripts/setup-branch-rulesets.sh --apply` — rulesets `development` (id
      21214233) e `main` (id 21214234), ambos `active`
- [x] **Verificar:** as regras estão ativas nas duas branches

      ```bash
      gh api repos/brunocbarbosa/NexusOps_frontend/rules/branches/development
      gh api repos/brunocbarbosa/NexusOps_frontend/rules/branches/main
      ```

      > **Não use `branches/<b>/protection`**: aquele endpoint só enxerga *branch protection*
      > clássica e responde 404 mesmo com ruleset ativo e funcionando. Ruleset e branch protection
      > são mecanismos distintos, e confundir os dois faz parecer que a aplicação falhou.

- [x] **Verificar (teste negativo):** push direto recusado nas duas branches, medido com commit
      vazio e `git reset --hard` em seguida:

      ```
      remote: error: GH013: Repository rule violations found for refs/heads/development.
      remote: - Changes must be made through a pull request.
      remote: - 8 of 8 required status checks are expected.
      ```

      O mesmo para `refs/heads/main`.

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

- [x] **Criar o secret e as variables NESTE repositório.** Feito em 2026-08-22. Medido antes:
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

- [x] **Ligar o Dependency graph.** Feito em 2026-08-22, junto com os Dependabot alerts e os security updates. Medido antes: o job `dependency-review` falha com
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

- [x] **Desligar Automatic Analysis** em *Administration → Analysis Method*. Feito em 2026-08-22.
      Com ela ligada, o job `sonar` morre com `You are running CI analysis while Automatic Analysis
      is enabled`. É o erro mais provável na primeira execução.
- [x] **Instalar/autorizar o GitHub App do SonarCloud** no repositório, para a decoração do PR.
      O gate já bloqueia sem ele (o passo `sonarqube-quality-gate-action` é quem reprova), mas os
      comentários no PR não aparecem.
- [x] **Conferir a New Code definition** do projeto.
- [x] **Confirmar o alcance do plano do SonarCloud.** Medido em 2026-08-22: a organização só dá
      acesso à branch principal e aos PRs.

      ```bash
      curl -s -o /dev/null -w '%{http_code}\n' 'https://sonarcloud.io/api/qualitygates/project_status?projectKey=brunocbarbosa_NexusOps_frontend&branch=main'         # 200
      curl -s -o /dev/null -w '%{http_code}\n' 'https://sonarcloud.io/api/qualitygates/project_status?projectKey=brunocbarbosa_NexusOps_frontend&pullRequest=1'       # 200
      curl -s -o /dev/null -w '%{http_code}\n' 'https://sonarcloud.io/api/qualitygates/project_status?projectKey=brunocbarbosa_NexusOps_frontend&branch=development'  # 403
      ```

      O corpo do 403 é `Organization is not allowed to access data from non main branches`. O job
      `sonar` passou a rodar só em PR e no push de `main`.

- [x] **Tornar `development` a branch principal do projeto.** O plano só serve dados da principal,
      e com `main` nesse papel todo PR de feature era recusado. O SonarCloud não deixa promover uma
      branch: o caminho é apagar `development` e **renomear** `main` para `development`. Mesmo
      arranjo já em uso no projeto do backend.

      ```bash
      curl -s 'https://sonarcloud.io/api/project_branches/list?project=brunocbarbosa_NexusOps_frontend'
      # development isMain=True, e mais nada
      ```

- [ ] **Opcional — o padrão *Detection of long lived branches* ficou em
      `(development|branch|release)-?.*`.** Trocado durante um diagnóstico que se provou errado, e
      hoje é configuração morta: o projeto tem uma única branch. Sem efeito colateral em deixar.

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
| 2026-08-22 | 2 | O job `sonar` roda em PR e no push de `main`, nunca no push de `development` | Não previsto na spec, que assumia analisar as duas branches. O plano da organização no SonarCloud não dá acesso a branch fora da principal: a leitura do gate com `branch=development` responde 403 com `Organization is not allowed to access data from non main branches`. O diagnóstico inicial culpou o tipo da branch (`SHORT`) e estava errado — reclassificar para `LONG` não mudou o 403. |
| 2026-08-22 | 5 | O critério de verificação do ruleset mudou de `branches/main/protection` para `rules/branches/<b>` | O endpoint legado só reporta *branch protection* clássica: com os dois rulesets ativos e recusando push, ele continua respondendo 404. O critério original daria falso negativo. |
| 2026-08-22 | 2 | Todo PR força `-Dsonar.pullrequest.base=main` | O plano recusa ler o gate de PR que mire branch fora da principal: `Organization is not allowed to access data from PR targeting non main branches`. Os PRs #1 e #3 passaram por acidente, com `development` ainda inexistente no SonarCloud e o scanner caindo de volta para `main`; assim que uma análise recriou a branch lá, o #4 deu 403. Declarar a base troca o acidente por decisão. |
| 2026-08-22 | 2 | A branch principal do projeto no SonarCloud é `development`, não `main` | O plano só serve dados da principal. Com `main` nesse papel, todo PR de feature (o caso comum) era recusado com `...PR targeting non main branches`. Inverter protege os PRs frequentes e deixa sem gate só o PR de release, que carrega código já gateado. |
| 2026-08-22 | 5 | O ruleset de `main` **não** exige o check `sonar` | O job pula em PR para `main` de propósito, e check pulado conta como satisfeito. Exigi-lo seria exigir um skip. As duas listas de checks obrigatórios passaram a ser diferentes por isso. |
| 2026-08-22 | 5 | O PR #4 precisou ser reaberto como #5 | O registro dele no SonarCloud ficou `isOrphan: true`, criado enquanto `development` ainda não era a principal. A chave do registro é o número do PR: nem rerun nem push novo reanexam a análise. Os PRs #1 e #3 se corrigiram sozinhos porque tinham análise válida anexada. |
| 2026-08-22 | 5 | Os rulesets foram aplicados duas vezes | A primeira aplicação exigia `sonar` nas duas branches. Depois que o job passou a pular nos PRs para `main`, foi preciso reaplicar com listas diferentes — o script é idempotente e atualizou os mesmos ids (21214233, 21214234) em vez de duplicar. |
| 2026-08-23 | 5 | `main` deixou de exigir histórico linear e passou a aceitar só merge commit | A spec previa histórico linear. Simulado antes do primeiro release: squash entre duas branches de vida longa quebra a ancestralidade — `main` sai da linha e os 34 commits somem do histórico, fazendo o release seguinte remergear tudo. `required_linear_history` proíbe exatamente o merge commit de que o fluxo depende. |

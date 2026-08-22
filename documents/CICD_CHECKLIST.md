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
- [ ] **Verificar na CI:** os cinco jobs verdes num PR real
- [ ] **Verificar na CI:** `branch-policy` reprova um PR de teste direto para `main`

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
- [ ] **Verificar na CI:** os quatro jobs verdes num PR real

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

## Passos manuais no SonarCloud

Nenhum é automatizável, e cada um falha de um jeito que não se parece com a causa.

- [ ] **Desligar Automatic Analysis** em *Administration → Analysis Method*.
      Com ela ligada, o job `sonar` morre com `You are running CI analysis while Automatic Analysis
      is enabled`. É o erro mais provável na primeira execução.
- [ ] **Instalar/autorizar o GitHub App do SonarCloud** no repositório, para a decoração do PR.
      O gate já bloqueia sem ele (o passo `sonarqube-quality-gate-action` é quem reprova), mas os
      comentários no PR não aparecem.
- [ ] **Conferir a New Code definition** do projeto.
- [ ] **Conferir que `development` aparece na lista de branches** do projeto. A lista só se popula
      depois do primeiro scan daquela branch.

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

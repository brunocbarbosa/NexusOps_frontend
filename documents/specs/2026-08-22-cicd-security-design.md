# Spec — CI/CD, testes e segurança

**Data:** 2026-08-22 · **Branch:** `ci/pipeline-cicd-security` → `development` · **Status:** implementado

Executa a parte 4 de [`../MAIN_FRONTEND.md`](../MAIN_FRONTEND.md). O scaffold entregou a metade local
do trio (Husky e Commitlint); esta entrega traz a metade que roda na pipeline. Progresso rastreado em
[`../CICD_CHECKLIST.md`](../CICD_CHECKLIST.md).

## 1. O que esta entrega é

A pipeline inteira, sem tela de produto. Ao final, nenhuma linha entra em `development` ou em `main`
sem passar por PR verde, e todo merge em `main` publica uma imagem.

**Critério de pronto:**

| Prova | Resultado esperado |
| --- | --- |
| PR para `development` | `quality`, `e2e`, `sonar`, `commits`, `branch-policy`, `codeql`, `dependency-review`, `audit`, `secrets` verdes |
| PR de branch qualquer direto para `main` | **reprovado** pelo job `branch-policy` |
| `docker build` | imagem sobe, `/api/health` responde, CSS responde 200 |
| Merge em `main` | `ghcr.io/brunocbarbosa/nexusops_frontend:latest` publicada |
| `gh api .../rules/branches/main` | lista as regras ativas (o endpoint legado `branches/main/protection` **não** enxerga ruleset e responde 404 mesmo funcionando) |

## 2. Estado encontrado

Medido no repositório em 2026-08-22, antes de qualquer alteração:

- `.github/` não existia. Nenhum workflow, nenhum Dependabot.
- `gh api repos/.../rulesets` devolvia `[]` e `main` respondia 404 em branch protection. **A política
  de branches do `CLAUDE.md` só existia como texto** — push direto em `main` funcionava.
- Sem `Dockerfile`, apesar de `output: 'standalone'` já configurado e do roadmap do README prometer a
  imagem no GHCR.
- Sem `sonar-project.properties`. O projeto já existia no SonarCloud com o secret e as três variables.
- `test-results/.last-run.json` estava versionado por engano, e o ESLint lintava o relatório HTML
  gerado em `coverage/` — `npm run lint` reprovava ou não dependendo de `npm run test:coverage` ter
  rodado antes.

## 3. Decisões

### 3.1 Quatro workflows, não um

`CI` (gate de qualidade), `Security` (SAST e dependências) e `Release` (imagem) são separados porque
respondem a gatilhos diferentes. O decisivo é o `Security`: ele tem `schedule` semanal, e CVE nova é
publicada **sem que ninguém faça commit**. Um workflow único disparado só por push nunca a
encontraria.

### 3.2 A política de branches vive em dois lugares, e precisa dos dois

Ruleset do GitHub sabe exigir PR, checks verdes e histórico linear. Não sabe dizer *de qual branch* o
PR pode vir. A regra "`main` só recebe `development`" fica então no job `branch-policy`, que lê
`github.base_ref` e `github.head_ref` e reprova o resto — e o ruleset a torna obrigatória.

Nenhum dos dois sozinho basta: só o job, e um push direto em `main` ignora a CI; só o ruleset, e um PR
de `feature/x` direto para `main` passa.

### 3.3 Aprovação obrigatória em zero, não em um

`required_approving_review_count: 0`. O GitHub não deixa o autor aprovar o próprio PR, e o projeto tem
um mantenedor. Exigir uma aprovação trancaria todo merge sem acrescentar revisor nenhum. O que segura
a qualidade aqui são os checks obrigatórios, não a contagem de aprovações.

O admin mantém bypass no escopo `pull_request` pelo mesmo motivo prático: sem ele, uma CI quebrada
bloquearia o commit que conserta a CI.

### 3.4 O Quality Gate reprova o job, não só decora o PR

`sonarqube-scan-action` apenas envia o relatório e sai com 0 mesmo quando o gate reprova. Sem o passo
`sonarqube-quality-gate-action`, o bloqueio dependeria do GitHub App do SonarCloud estar instalado —
uma dependência de configuração externa, invisível no repositório, que um dia é desinstalada e ninguém
percebe. O passo torna o gate uma falha de job, visível no YAML.

`fetch-depth: 0` no job: sem o histórico completo o Sonar não consegue datar linhas nem calcular *New
Code*. A análise sai mesmo assim — medindo a coisa errada, que é pior que não sair.

**Corrigido em 2026-08-22, depois do merge:** o job roda em PR e no push de `main`, nunca no push de
`development`. O plano da organização no SonarCloud não dá acesso a branch fora da principal — a
leitura do gate com `branch=development` responde 403 com `Organization is not allowed to access
data from non main branches`. Nada se perde: o commit que chega em `development` é o mesmo que já
passou pelo gate no PR.

### 3.5 `organization` e `projectKey` fora do arquivo versionado

Vão por `args` a partir de `vars.SONAR_ORGANIZATION` e `vars.SONAR_PROJECT_KEY`. Um fork analisa no
próprio projeto sem editar arquivo versionado, e `vars.SONAR_ENABLED` é o interruptor: sem ele, um
fork ficaria com o gate vermelho por falta de credencial, não por falta de qualidade.

### 3.6 `npm audit` partido em dois

`--omit=dev` bloqueia em `high`; o audit completo é informativo. Uma CVE no Playwright é dívida a
agendar; uma CVE no `next` vai para produção dentro da imagem. Tratar as duas como a mesma coisa
significa ou travar merges de produto por causa de dependência de build, ou baixar o nível dos dois.

### 3.7 O `e2e` reconstrói em vez de reaproveitar artefato

`.next/standalone` é uma árvore parcial de `node_modules` com symlinks e bits de permissão.
Empacotá-la em artefato para economizar ~90 s troca correção por velocidade num projeto que builda em
minutos. Revisitar quando o build passar de ~5 min.

### 3.8 `Release` não é acorrentado à CI por `workflow_run`

Push em `main` só acontece por merge de PR vindo de `development` — PR que já passou pela CI e pelo
Security, e o ruleset de `main` garante isso. `workflow_run` daria a mesma garantia ao custo de um
workflow rodando num contexto de commit diferente do que o disparou, o que complica log e permissão.
A garantia mora no ruleset.

## 4. Docker

Três estágios em `node:24-alpine`, 67 MB medidos, usuário `nextjs` (uid 1001).

Duas linhas carregam armadilhas que o projeto já conhecia:

- **`COPY /app/.next/static` é manual.** O `next build` não põe os estáticos dentro do standalone.
  Sem a linha, o container responde 200 servindo a página sem CSS — exatamente o que
  `scripts/start-standalone.sh` existe para evitar, agora repetido no Dockerfile.
- **`HOSTNAME=0.0.0.0` é explícito.** O `server.js` do standalone escuta em localhost quando a
  variável não é definida; dentro de um container isso responde só a si mesmo e o mapeamento de porta
  devolve *connection refused*.

`libc6-compat` nos estágios de build: o SWC do Next é binário nativo linkado contra glibc.

**`src/app/api/health/route.ts` é ampliação deliberada de escopo.** O `CLAUDE.md` dizia que nenhum
Route Handler existia e que o primeiro seria o do login. Este não toca em autenticação nem em tenant,
e existe porque uma imagem sem `HEALTHCHECK` é meio CD. Deliberadamente **não** consulta a API NestJS:
a pergunta é "este processo Next está servindo?", não "a API está de pé?" — encadear as duas faria uma
indisponibilidade da API reiniciar containers de frontend saudáveis.

O nome da imagem é passado para minúsculo num passo próprio. `docker/metadata-action` normaliza
sozinho, mas `actions/attest-build-provenance` não, e o `subject-name` precisa bater caractere a
caractere com a imagem publicada. O repositório se chama `NexusOps_frontend`, com maiúsculas que o
GHCR rejeita.

## 5. Alternativas descartadas

| Alternativa | Por que não |
| --- | --- |
| Artefato de build compartilhado entre `quality` e `e2e` | Symlinks e permissões do standalone em artefato: economiza ~90 s e arrisca um E2E verde contra artefato corrompido |
| `workflow_run` acorrentando `Release` à `CI` | Roda num contexto de commit diferente do que disparou; o ruleset de `main` já dá a garantia |
| Uma aprovação obrigatória por PR | Mantenedor solo não aprova o próprio PR — trancaria todo merge sem acrescentar revisor |
| Threshold de cobertura no Jest | Duplicaria o gate. O SonarCloud já mede cobertura sobre *New Code*, que é a métrica que importa numa base que começa pequena |
| `sonar-project.properties` com org e chave dentro | Quebra fork e ignora as variables que já existiam no repositório |
| Prettier na pipeline | Não está instalado no projeto. Adicioná-lo é decisão de estilo, não de CI |

## 6. O que a pipeline ainda não faz

Registrado para não parecer esquecimento:

- **Não faz deploy.** Publica a imagem no GHCR; quem a consome ainda não existe.
- **Não versiona automaticamente.** Tags `v*.*.*` são criadas à mão; não há release-please nem
  changelog gerado.
- **Não tem cabeçalhos de segurança HTTP** (CSP, HSTS) no `next.config.ts`. CSP com Next exige nonce
  por requisição e pertence à fatia de login, junto do middleware.
- **Não roda E2E contra a imagem Docker**, só contra o artefato standalone local — que é o mesmo
  código, mas não o mesmo empacotamento.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Leia também [`AGENTS.md`](./AGENTS.md): o Next.js 16 o mantém automaticamente (o bloco é reescrito a
cada `next dev`) e ele avisa que esta versão tem *breaking changes* em relação ao conhecimento
pré-treinado dos agentes, apontando a documentação real em `node_modules/next/dist/docs/`. Consulte
essa pasta antes de escrever código de Next, em vez de confiar na memória.

## Comandos

| Comando | Faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção; emite `.next/standalone/` |
| `npm run start:standalone` | sobe o artefato standalone (o mesmo que a imagem Docker roda) |
| `npm run lint` | ESLint, com regras que usam informação de tipo |
| `npm test` | Jest + RTL |
| `npm test -- <caminho>` | **um único arquivo de teste** |
| `npm run test:watch` | Jest em watch |
| `npm run test:coverage` | cobertura |
| `npm run e2e` | Playwright contra o build standalone |
| `npm run e2e:ui` | Playwright em modo interativo |
| `npm run typecheck` | `tsc --noEmit` isolado |
| `docker build -t nexusops-frontend .` | mesma imagem que a CI publica no GHCR |
| `bash scripts/setup-branch-rulesets.sh` | simula a política de branches no GitHub (`--apply` aplica) |


### Coisas que mordem

- **`next start` não funciona com `output: standalone`.** Use `npm run start:standalone`, que copia
  `.next/static` para dentro de `.next/standalone/` antes de subir — o `next build` não faz essa
  cópia. Sem ela o servidor responde 200 servindo a página **sem CSS**, e um teste que só verifique
  texto passa verde.
- **TypeScript está fixado em 6.0.3, não no `latest`.** O `typescript-eslint` declara peer
  `<6.1.0`; subir para o TS 7 desliga silenciosamente todas as regras de lint com tipo.
- **ESLint está em 9.39.5, não 10.** `eslint-plugin-react`, `eslint-plugin-import` e
  `eslint-plugin-jsx-a11y` não suportam o ESLint 10 em nenhuma versão publicada.
- **Os hooks de commit são reais**: `pre-commit` roda lint, `commit-msg` roda Commitlint
  (Conventional Commits). Mensagem fora do padrão é rejeitada.

- **Automatic Analysis do SonarCloud precisa estar DESLIGADA.** Com ela ligada, o job `sonar` morre
  com `You are running CI analysis while Automatic Analysis is enabled`. É o erro mais provável de
  aparecer na primeira execução da pipeline.
- **O `sonarqube-scan-action` sai com 0 mesmo quando o Quality Gate reprova** — ele só envia o
  relatório. Quem reprova é o passo `sonarqube-quality-gate-action` logo depois. Remover esse passo
  deixa o gate verde para sempre.
- **O SonarCloud desta organização só analisa a branch principal e os PRs.** Medido: a leitura do
  Quality Gate com `branch=development` responde **403** com
  `Organization is not allowed to access data from non main branches`, enquanto `branch=main` e
  `pullRequest=N` respondem 200. Por isso o job `sonar` só roda em PR e no push de `main` — analisar
  `development` geraria um scan ilegível e um gate que nunca passa. Nada se perde: o commit que
  chega em `development` é o mesmo que já passou pelo gate no PR.

  O erro engana: chega como `curl: (22) The requested URL returned error: 403` no passo do gate,
  com o scan tendo passado. **Não é tipo de branch** — reclassificar `development` de `SHORT` para
  `LONG` não muda nada. Só o corpo da resposta diz a verdade.
- **`fetch-depth: 0` nos jobs `sonar` e `secrets` não é otimização.** Sem o histórico completo o
  Sonar não data as linhas e mede "New Code" errado, e o gitleaks não enxerga o commit onde o
  segredo realmente entrou.
- **`e2e` e `e2e:ui` são os nomes dos scripts**, não `test:e2e`.

## Estado do repositório

Scaffold pronto e verificado: Next 16 (App Router, `src/`, `output: standalone`), TypeScript 6
estrito, Tailwind 4 + shadcn/ui (base Radix, preset nova), TanStack Query/Table/Virtual, Jest + RTL,
Playwright, Husky + Commitlint.

Pipeline pronta: GitHub Actions em três workflows (`CI`, `Security`, `Release`), SonarCloud com
Quality Gate bloqueante, CodeQL, Dependency Review, `npm audit`, gitleaks, Dependabot e imagem Docker
publicada no GHCR a cada merge em `main`.

**Ainda não existe**: nenhuma tela de produto e nenhum cliente de API. O único Route Handler é
`src/app/api/health/route.ts`, que serve ao `HEALTHCHECK` da imagem e não toca no backend — o
primeiro Route Handler de produto é o proxy de login. `src/app/page.tsx` é página de verificação do
scaffold, não UI de produto: a primeira tela real substitui o arquivo inteiro.

O design que originou este scaffold está em
[`documents/specs/2026-08-22-frontend-scaffold-design.md`](./documents/specs/2026-08-22-frontend-scaffold-design.md).

## Fluxo de branches

**`development` é a branch principal de trabalho.** Todo trabalho passa por ela.

- Parta de `development` para qualquer feature ou correção — nunca de `main`.
- **`main` só recebe código vindo de `development`**, nunca commits diretos e nunca merge de uma
  branch de feature. `main` é a linha de release.
- Isto é **exigido**, não combinado: o job `branch-policy` da CI reprova PR para `main` vindo de
  outra branch, e `scripts/setup-branch-rulesets.sh` aplica os rulesets que exigem PR e checks
  verdes nas duas branches. Ruleset do GitHub não sabe expressar "a head branch precisa ser
  `development`" — por isso a regra vive nos dois lugares, e precisa dos dois.
- O `.claude/` é versionado neste repositório: skills e agents foram ajustados à stack decidida aqui,
  então reinstalá-los via `npx claude-code-templates` sobrescreve as customizações. Veja o commit
  `f3a3938` para o que foi removido e por quê.

## Documentos de referência

| Arquivo                                                                  | Leia antes de                                                     |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| [`documents/MAIN.md`](./documents/MAIN.md)                                | entender o objetivo geral do produto e os diferenciais técnicos    |
| [`documents/MAIN_FRONTEND.md`](./documents/MAIN_FRONTEND.md)              | qualquer decisão de stack ou estrutura de pastas                  |
| [`documents/specs/2026-08-22-cicd-security-design.md`](./documents/specs/2026-08-22-cicd-security-design.md) | mexer em workflow, Dockerfile ou política de branches |
| [`documents/backend/USERS.md`](./documents/backend/USERS.md)              | implementar login, refresh, senhas ou telas de usuários           |
| [`documents/backend/TENANCY_EXTENSION.md`](./documents/backend/TENANCY_EXTENSION.md) | entender por que a API responde 404 e não 403          |
| [`documents/backend/RLS_NOTES.md`](./documents/backend/RLS_NOTES.md)      | contexto de isolamento no banco (não afeta o frontend diretamente)|

`documents/backend/` é uma **cópia trazida do repositório do backend** — esses arquivos não nascem
aqui e não devem ser editados neste repositório. Quem os mantém é o Bruno, que os atualiza sempre que
altera algo no backend. Se algo neles parecer errado ou desatualizado, avise em vez de corrigir o
arquivo: a correção pertence ao repositório de origem.

O conteúdo deles é **comportamento medido** na API, não teoria. Quando um deles contradisser uma
suposição sua sobre a API, o documento vence.

## O produto

SaaS B2B multi-tenant: empresas se cadastram como **Tenants** para gerenciar chamados internos de TI,
controle de ativos (notebooks, licenças) e auditoria. Escopo completo em `documents/MAIN.md`.

Quatro decisões do produto caem diretamente no frontend:

- **409 Conflict é fluxo previsto, não erro genérico.** Tickets usam controle otimista de
  concorrência por coluna `version`: dois analistas editando o mesmo chamado — o segundo recebe 409.
  A UI precisa avisar que os dados mudaram e oferecer recarregar, não só mostrar "erro ao salvar".
- **Relatórios são assíncronos.** A API responde **202 Accepted** e enfileira o trabalho; o resultado
  chega por Server-Sent Events ou WebSocket ("seu relatório está pronto"). A tela nunca espera a
  resposta do PDF.
- **Auditoria é uma timeline.** `audit_logs` registra toda mutação; no chamado isso é renderizado
  como linha do tempo — e é a lista longa que motiva a virtualização.
- **Multi-tenancy é premissa, não feature.** Nenhuma tela envia `tenantId` por conta própria: o
  backend deriva o tenant do contexto da requisição.

## Stack decidida

Next.js (React) + TypeScript · TanStack Query para estado de servidor · `@tanstack/react-virtual`
para listas longas · Tailwind + Shadcn/ui (ou Radix) para o Design System · TanStack Table para as
data grids · Jest + RTL para unidade · Playwright para E2E · Husky, Commitlint e SonarCloud na
pipeline. Detalhes e justificativas em `documents/MAIN_FRONTEND.md`.

Build de produção em modo `standalone` do Next.js — a imagem Docker depende disso.

## Arquitetura

**Organização por feature, espelhando os módulos do backend NestJS** (`identity`, `helpdesk`,
`auditing`). Cada `features/<domínio>/` concentra componentes, hooks, queries do TanStack Query e
tipagens daquele domínio. O que é global fica global de propósito, não por acúmulo: um componente
complexo específico de um domínio (a timeline de auditoria de um chamado, por exemplo) mora na
feature, não em `components/`.

Regras que decorrem da stack:

- **Estado de servidor é do TanStack Query.** Não duplicar resposta de API em `useState`/store global.
- **Toda lista potencialmente grande é virtualizada** (`@tanstack/react-virtual`) — logs de auditoria
  e listagens de chamados são o caso motivador.
- **Tabelas usam TanStack Table** (headless): ordenação e paginação vêm dela, não de implementação
  manual por tela.

## Contrato com a API (medido no backend)

Pontos que mudam o desenho das telas — o *porquê* de cada um está em `documents/backend/USERS.md`:

- **Login carrega `tenantDomain` no body.** `User.email` só é único dentro de um tenant, então email
  sozinho é ambíguo; o formulário de login precisa do domínio da empresa.
- **401 idêntico para tenant inexistente, usuário inexistente e senha errada.** Não tente diferenciar
  os casos na UI — o backend deliberadamente não diferencia (inclusive no tempo de resposta).
- **404, nunca 403, para recurso de outro tenant.** 403 significa papel insuficiente; 404 significa
  "não existe *para você*". Tratar os dois de forma diferente na UI.
- **Access token de 15 min + refresh token rotativo com detecção de reuso.** Um refresh reusado revoga
  a família inteira: o cliente precisa serializar refreshes (um voo por vez) — dois refreshes
  simultâneos com o mesmo token derrubam a sessão do usuário.
- **Senha limitada a 72 *bytes*, não caracteres** (bcrypt trunca em silêncio). A validação no
  formulário deve contar bytes — um emoji custa 4.
- **Troca de senha só em `PATCH /users/me/password`**, exige a senha atual e **encerra todas as
  sessões**. As telas de admin não trocam senha de terceiros.
- **Usuário é deletado logicamente e o email continua ocupado.** Ao criar um usuário com email de um
  desativado, a API devolve o id para restaurar via `POST /users/:id/restore` — o fluxo de "usuário já
  existe" precisa oferecer restaurar, não só reportar erro.
- **Flags booleanas em query string** (ex.: `includeDeleted`) são texto no backend; envie `'true'`/
  `'false'` explicitamente e não omita esperando um default implícito.

## Próximo passo

A fatia de login ponta a ponta, que é o que prova a arquitetura de BFF decidida na spec: formulário
com `tenantDomain`, Route Handler fazendo proxy para o NestJS, access token em cookie `httpOnly`,
`middleware.ts` protegendo rotas e refresh serializado no servidor.

É também onde entram os cabeçalhos de segurança HTTP (CSP, HSTS): CSP com Next exige nonce por
requisição e pertence ao mesmo middleware, não ao `next.config.ts` isolado.

O Next 16 traz guias locais diretamente aplicáveis a isso — veja
`node_modules/next/dist/docs/01-app/02-guides/backend-for-frontend.md` e `.../multi-tenant.md`.

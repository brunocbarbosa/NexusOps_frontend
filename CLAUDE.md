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
| `npm run lint` | `next typegen && eslint` — regras que usam informação de tipo |
| `npm test` | Jest + RTL |
| `npm test -- <caminho>` | **um único arquivo de teste** |
| `npm run test:watch` | Jest em watch |
| `npm run test:coverage` | cobertura |
| `npm run e2e` | Playwright contra o build standalone |
| `npm run e2e:ui` | Playwright em modo interativo |
| `npm run typecheck` | `next typegen && tsc --noEmit` |
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
- **O SonarCloud desta organização só serve dados da branch principal do projeto — que lá é a
  `development`, não a `main`.** Foi configurada assim de propósito: `development` é o alvo de todo
  PR de feature, e é o recorte que precisa ser legível. Duas mensagens de recusa, ambas chegando
  como o mesmo `curl: (22) The requested URL returned error: 403` no passo do Quality Gate, com o
  scan tendo passado — só o corpo da resposta distingue:

  - `Organization is not allowed to access data from non main branches`
  - `Organization is not allowed to access data from PR targeting non main branches`

  Por isso o job `sonar` roda **só em PR para `development` e no push de `development`**, e o
  ruleset de `main` **não** exige `sonar` — exigir um check que sempre pula é pedir verde por
  ausência. O PR de release `development → main` fica sem gate de propósito: ele carrega código que
  já passou pelo gate ao entrar em `development`.

  Três becos sem saída já percorridos, para ninguém repetir: **não é tipo de branch** (reclassificar
  `development` de `SHORT` para `LONG` não muda nada); **não adianta forçar
  `-Dsonar.pullrequest.base`** (o SonarCloud lê o alvo pela integração com o GitHub e ignora o
  parâmetro — e informá-lo ainda desliga a auto-configuração, quebrando o scan com
  `Parameter 'sonar.pullrequest.key' is mandatory`); e **não confie em PR antigo que passou** (os
  #1 e #3 passaram porque `development` ainda não existia no SonarCloud e o scanner caía para `main`
  sozinho).

- **`fetch-depth: 0` nos jobs `sonar` e `secrets` não é otimização.** Sem o histórico completo o
  Sonar não data as linhas e mede "New Code" errado, e o gitleaks não enxerga o commit onde o
  segredo realmente entrou.
- **`npm run lint` roda `next typegen` antes do ESLint, e isso não é enfeite.** `PageProps<>` e
  `RouteContext<>` são **tipos gerados** em `.next/types/`, e `next-env.d.ts` é gitignored. Num
  checkout limpo — a CI, um `git clone` — eles não existem, e as regras com informação de tipo veem
  `error typed value` em vez do tipo: o job `quality` reprovou com 17 erros num código que passava na
  máquina, porque ali um `next dev` mantinha `.next/dev/types` atualizado. Reproduzir isso localmente
  exige um checkout sem `.next` (`git worktree add --detach`), não só apagar a pasta com o dev server
  no ar.
- **Renovação de sessão: compartilhar o voo em andamento não basta.** Duas requisições disparadas
  juntas pelo browser chegam escalonadas ao servidor, e a segunda ainda carrega o cookie antigo — o
  `Set-Cookie` da primeira não voltou. Reapresentar um refresh token gasto faz o backend revogar a
  família inteira e derrubar a sessão. Por isso `src/lib/api/refresh.ts` **lembra** do par por 30
  segundos, e não só enquanto a renovação corre. Medido contra o backend real: sem a janela, de
  cinco requisições concorrentes uma passa e quatro tomam 401.
- **`e2e` e `e2e:ui` são os nomes dos scripts**, não `test:e2e`. O Playwright sobe **dois**
  servidores: o artefato standalone e `e2e/support/fake-api.mjs`, um dublê do NestJS — a suíte E2E
  não precisa do backend, do Postgres nem do Redis.
- **`npm run e2e` não constrói nada.** Ele sobe o `.next/standalone` que já existir, então rodar sem
  `npm run build` antes testa o código da última build e passa verde por engano. Aconteceu: uma
  mudança de roteamento foi dada como verificada contra um artefato de outro dia.
- **A suíte E2E roda com `workers: 1`, de propósito.** O dublê é um processo único com estado
  global e todo spec que o muta começa com `POST /__reset`. Dois arquivos em paralelo se atropelam:
  o reset de um apaga a sessão que o outro acabou de abrir, e a falha aparece como um login que
  "não redirecionou".
- **`columns` do TanStack Table não pode depender de estado que chega tarde.** Recriá-lo troca a
  identidade do `table` e do componente `table.FlexRender`; o React lê isso como outro tipo,
  desmonta a árvore e recria cada célula. Como `/auth/me` resolve **depois** da listagem, uma
  coluna que dependesse do papel remontava a tabela inteira ao responder a sessão.
- **O backend também escuta na 3000.** Em desenvolvimento, backend em 3000 e Next em 3001
  (`PORT=3001 npm run dev`), com `NEXUSOPS_API_URL=http://localhost:3000` (ver `.env.example`).
- **O TanStack Table 9 é ESM puro.** Ele está em `transpilePackages` no `next.config.ts`; sem isso
  todo teste que renderize a grid morre com `Cannot use import statement outside a module`.
- **O jsdom não tem `TextEncoder`, a Fetch API, Pointer Events nem `scrollIntoView`.** O
  `src/test/setup.ts` preenche o primeiro e os dois últimos — sem eles o Radix não abre `Select` nem
  `DropdownMenu`, e `userEvent.click` morre com `target.hasPointerCapture is not a function`. Os
  dublês de `Element.prototype` são **guardados por `typeof Element !== "undefined"`**: testes de
  Route Handler declaram `@jest-environment node`, onde `Element` não existe. Testes de componente
  usam os dublês de `src/test/http.ts` para a Fetch API.

## Estado do repositório

Scaffold pronto e verificado: Next 16 (App Router, `src/`, `output: standalone`), TypeScript 6
estrito, Tailwind 4 + shadcn/ui (base Radix, preset nova), TanStack Query/Table/Virtual, Jest + RTL,
Playwright, Husky + Commitlint.

Pipeline pronta e exercitada num PR real: GitHub Actions em três workflows (`CI`, `Security`,
`Release`), SonarCloud com Quality Gate que reprova o job, CodeQL, Dependency Review, `npm audit`,
gitleaks e Dependabot. Os rulesets das duas branches estão aplicados e recusam push direto.

**O `Release` ainda não rodou.** Ele dispara no push de `main`, e nenhum merge `development → main`
aconteceu até agora — a imagem foi construída e validada localmente (67 MB, uid 1001, `/api/health`
respondendo, CSS servido com 200), mas nunca publicada no GHCR. O primeiro merge de release é o que
prova essa metade.

**A fatia `identity` está implementada**: login, sessão em cookie `httpOnly`, refresh serializado,
listagem e administração de usuários, e troca da própria senha. O desenho está em
[`documents/specs/2026-08-23-identity-login-users-design.md`](./documents/specs/2026-08-23-identity-login-users-design.md).

**A fatia `platform` está implementada**: o console do operador (`ADMIN_MASTER`) em
`/platform/**` — listar, criar, editar, bloquear e apagar companies, e gerenciar os usuários de
cada uma. Desenho em
[`documents/specs/2026-08-25-platform-operator-console-design.md`](./documents/specs/2026-08-25-platform-operator-console-design.md).

Três regras que caíram daí:

- **Os papéis não são hierárquicos**, nem por convenção. `ADMIN_MASTER` toma **403 em `/users`** e
  chega aos usuários de uma company por `/platform/companies/:id/users`. São duas árvores de rota
  separadas, não um console com telas a mais para quem tem mais poder. `ASSIGNABLE_ROLES` (os três
  de company) alimenta todo `<Select>` de papel; `ROLES` (os quatro) é só para exibir.
- **O destino pós-login vem do papel na resposta do login.** Nem o `proxy.ts` nem um Server
  Component podem descobri-lo, então `landingPath(role, next)` decide no cliente e `/` é o único
  despachante. Um `?next=` do outro console é descartado — o porteiro o guardou sem saber quem
  viria entrar.
- **A tela de usuários é a mesma nos dois consoles**, parametrizada por `UsersScope`
  (`src/features/identity/users-scope.tsx`). Os hooks leem o escopo por contexto, então
  `useUsers()` e `useCreateUser()` mantêm a assinatura e os diálogos não sabem em qual console
  estão. `queryKeyRoot` faz parte do escopo: sem ele na chave, o cache de uma company vaza na
  outra.

Duas regras que caíram daí e valem para as próximas telas:

- **Nenhum Server Component busca dado autenticado.** Só Route Handler, Server Action e `proxy.ts`
  gravam cookie; um RSC que renovasse a sessão gastaria o refresh token sem conseguir persistir o
  par rotacionado — e reapresentar o antigo revoga a família inteira. Todo dado autenticado passa
  por um Route Handler e chega à tela pelo TanStack Query.
- **`src/lib/api/server.ts` é o único lugar que fala com o NestJS autenticado.** Handler que monta a
  requisição por conta própria pode esquecer o `Bearer`, renovar duas vezes ou vazar o token.

**Ainda não existe**: helpdesk (chamados), ativos e auditoria — nenhuma tela, nenhum Route Handler.
E **não há CSP**; os cabeçalhos de segurança simples estão em `src/lib/security-headers.ts`.

**`POST /auth/register` foi removido do backend** — responde 404, inclusive com token válido. Não
há e não deve haver tela de cadastro: companies nascem no console do operador, e o operador nasce
de `ADMIN_MASTER_EMAIL`/`ADMIN_MASTER_PASSWORD` no `.env` do backend, reconciliado a cada boot.

O design que originou este scaffold está em
[`documents/specs/2026-08-22-frontend-scaffold-design.md`](./documents/specs/2026-08-22-frontend-scaffold-design.md).

## Fluxo de branches

**`development` é a branch principal de trabalho.** Todo trabalho passa por ela.

- Parta de `development` para qualquer feature ou correção — nunca de `main`.
- **`main` só recebe código vindo de `development`**, nunca commits diretos e nunca merge de uma
  branch de feature. `main` é a linha de release.
- Isto é **exigido**, não combinado, desde 2026-08-22. A regra vive em dois lugares porque precisa
  dos dois: o ruleset do GitHub sabe exigir PR e checks verdes, mas **não sabe dizer de qual branch
  o PR pode vir** — essa metade é o job `branch-policy` da CI, que reprova PR
  para `main` vindo de outra branch. Os rulesets aplicados por `scripts/setup-branch-rulesets.sh`
  recusam push direto nas duas (`GH013: Repository rule violations found`).
- **O PR de release `development → main` fecha com *merge commit*, nunca com squash.** As duas são
  branches de vida longa, e squash entre elas quebra a ancestralidade: o commit esmagado não existe
  em `development`, então o release seguinte tenta remergear os mesmos commits e conflita. Medido nos
  34 commits do primeiro release — squash tira `main` da linha de ancestralidade e some com os 34 do
  histórico; merge commit deixa `development` contido em `main`, intacto. O ruleset de `main` aceita
  só `merge` por isso, e **não** exige histórico linear, que proibiria exatamente esse merge.
- **Para conferir o ruleset, use `gh api repos/<owner>/<repo>/rules/branches/<branch>`.** O endpoint
  legado `branches/<branch>/protection` só enxerga *branch protection* clássica e responde 404 mesmo
  com ruleset ativo e recusando push — daria falso negativo numa configuração que funciona.
- O `.claude/` é versionado neste repositório: skills e agents foram ajustados à stack decidida aqui,
  então reinstalá-los via `npx claude-code-templates` sobrescreve as customizações. Veja o commit
  `f3a3938` para o que foi removido e por quê.

## Documentos de referência

| Arquivo                                                                  | Leia antes de                                                     |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| [`documents/MAIN.md`](./documents/MAIN.md)                                | entender o objetivo geral do produto e os diferenciais técnicos    |
| [`documents/MAIN_FRONTEND.md`](./documents/MAIN_FRONTEND.md)              | qualquer decisão de stack ou estrutura de pastas                  |
| [`documents/TESTE_MANUAL.md`](./documents/TESTE_MANUAL.md)                | testar as telas na mão: contas do tenant de dev e o que observar  |
| [`documents/backend/PLATFORM.md`](./documents/backend/PLATFORM.md)        | mexer no console do operador, em companies ou no papel `ADMIN_MASTER` |
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

A fatia de helpdesk: listagem de chamados (virtualizada, esta sim), abertura, e o **409 de conflito
de versão** — a primeira tela em que o controle otimista do backend aparece na UI.

Antes ou junto: **CSP com nonce**, que ficou de fora da fatia de login de propósito. O nonce é gerado
no `proxy.ts` e exige renderização dinâmica em toda página — ver
`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`.

> **`middleware.ts` não existe mais.** O Next 16 depreciou o arquivo e o renomeou para `proxy.ts`
> (na raiz de `src/`). A porta de rotas e os cabeçalhos de segurança moram lá.

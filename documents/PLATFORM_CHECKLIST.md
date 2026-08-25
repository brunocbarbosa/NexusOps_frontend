# Checklist — console do operador da plataforma (`ADMIN_MASTER`)

Rastreia a execução da spec
[`specs/2026-08-25-platform-operator-console-design.md`](./specs/2026-08-25-platform-operator-console-design.md).
Uma tarefa só é marcada depois da verificação passar — **não** depois do comando rodar.

**Legenda:** `[ ]` pendente · `[x]` concluída e verificada · `[!]` bloqueada (motivo ao lado)

**Contrato:** [`FRONTEND_PLATFORM_SPEC.md`](./FRONTEND_PLATFORM_SPEC.md) e
[`backend/PLATFORM.md`](./backend/PLATFORM.md). Quando os dois discordarem, vence o payload
capturado do `backend/`.

---

## Camada 1 — Documentos

- [x] `documents/PLATFORM_CHECKLIST.md` (este arquivo)
- [x] `documents/specs/2026-08-25-platform-operator-console-design.md`
- [x] Commit `docs:`

## Camada 2 — Papéis: separar exibir de atribuir

- [x] `ASSIGNABLE_ROLES` (três) e `ROLES` (quatro) em `src/features/identity/types.ts`
- [x] `AssignableRole` × `Role`; `isUserRole` → `isAssignableRole`
- [x] `User.role: AssignableRole` — nenhuma listagem devolve `ADMIN_MASTER`
- [x] `SessionUser.role: Role` e o `{ user }` de `useLogin()` com `Role` — os dois carregam o operador
- [x] `role-badge.tsx` com quatro entradas (`ADMIN_MASTER` → "Platform operator")
- [x] `users-toolbar.tsx` e `user-form-dialog.tsx` iterando `ASSIGNABLE_ROLES`
- [x] `app-shell.tsx` com `NavItem.roles: readonly Role[]`
- [x] `src/app/api/users/route.ts` usando `isAssignableRole`
- [x] **Verificar:** `npm run typecheck` limpo
- [x] **Verificar:** `npm test` verde
- [x] Commit

## Camada 3 — Superfície do BFF

- [x] `pickBooleans()` em `src/lib/api/payload.ts` (`isActive` é booleano; `pickStrings` não serve)
- [x] `api/platform/companies/route.ts` — GET (query remontada campo a campo) e POST (corpo **aninhado**)
- [x] `api/platform/companies/[companyId]/route.ts` — GET, PATCH, DELETE
- [x] `api/platform/companies/[companyId]/users/route.ts` — GET, POST
- [x] `api/platform/companies/[companyId]/users/[userId]/route.ts` — PATCH, DELETE
- [x] `api/platform/companies/[companyId]/users/[userId]/restore/route.ts` — POST
- [x] `isActive` na query só é encaminhado quando vale exatamente `"true"` ou `"false"` (ausente = os dois)
- [x] `perPage` com teto 100 (101 é **400** no backend, não clamp)
- [x] Um `route.test.ts` por handler (`@jest-environment node` + `cookie-jar`)
- [x] **Verificar:** `npm test` verde
- [x] **Verificar:** `npm run lint` limpo (roda `next typegen`, que gera os `RouteContext<>` novos)
- [x] Commit

## Camada 4 — Escopo de usuários (refactor da fatia `identity`)

- [x] `src/features/identity/users-scope.tsx` — `UsersScope`, `UsersScopeProvider`, `useUsersScope`
- [x] `queries/users.ts` lendo o escopo; **assinaturas públicas dos hooks inalteradas**
- [x] `queryKeyRoot` na chave de cache — sem ele, abrir a company A e depois a B mostra os usuários de A
- [x] `UsersScreen` extraído de `users-page.tsx`; `UsersPage` vira casca com o escopo de identity
- [x] `users-toolbar.tsx`: `isAdmin` → `canManage` / `canIncludeDeleted`
- [x] `EmptyState` extraído para `src/components/empty-state.tsx`
- [!] **Critério de aceite ajustado.** `users-page.test.tsx` passou sem edição, mas
      `user-form-dialog.test.tsx` **precisou** ser envolvido num `UsersScopeProvider`: o diálogo
      chama `useCreateUser()` lá de dentro, e sem escopo não há para onde mutar. Deixar
      `useUsersScope()` cair num padrão silencioso evitaria a edição e criaria o bug que ele existe
      para impedir — uma tela do operador sem provider mutaria `/api/users`, na company errada.
      A edição é a expressão honesta do novo requisito
- [x] **Verificar:** `npm test` verde (147 testes, 28 suítes)
- [x] **Verificar:** `npm run typecheck` limpo
- [x] Commit


### Achado: a tabela remontava a cada resposta de `/auth/me`

`columns` do TanStack dependia de `canManage`. Recriá-lo troca a identidade do `table`, e com ela o
componente `table.FlexRender` — o React lê isso como outro tipo, desmonta a árvore e recria cada
célula. Como `/auth/me` resolve **depois** de `/users`, a tabela inteira era remontada assim que a
sessão respondia. `columns` agora não depende do papel; quem pode gerenciar é decidido dentro da
célula, que lê o escopo. Apareceu como um teste achando um `<span>` já desconectado do DOM.

## Camada 5 — Tela de companies

- [x] `npx shadcn@latest add checkbox` (não estava instalado)
- [x] `src/features/platform/types.ts` — `Company`, `CompaniesPage`, `CompaniesQuery`, `CreateCompanyInput`, `CreateCompanyResult`
- [x] `src/features/platform/queries/` — `platformKeys` e os hooks de company
- [x] Listagem: busca com debounce 300 ms, filtro Active/Blocked/All, paginação de servidor
- [x] Coluna Domain rende `—` quando `null` (o backend permite)
- [x] **Checkbox "Active"**: não muta sozinho — abre `AlertDialog` que nomeia a company, e o diálogo
      **não fecha no erro** (`event.preventDefault()`)
- [x] Criar company: um diálogo, duas seções (Company + Administrator) — a API recusa criar sem ADMIN
- [x] Senha do ADMIN validada em **bytes** (reusar `validatePassword`/`passwordByteLength`)
- [x] No 201, painel de credenciais que **só fecha por botão explícito** — não há convite nem reset
- [x] Editar nome/domínio; 409 de domínio duplicado vira erro no campo
- [x] `DELETE` num diálogo separado, exigindo digitar o nome da company, oferecendo bloquear como alternativa
- [x] **Verificar:** `npm test` verde (164 testes, 30 suítes)
- [x] Commit

### Achado: o Radix não abre no jsdom

`userEvent.click` num `Select` ou `DropdownMenu` morria com
`target.hasPointerCapture is not a function` — o jsdom não implementa a Pointer Events API nem
`scrollIntoView`. Dublês em `src/test/setup.ts`, ao lado do `TextEncoder`, e **guardados por
`typeof Element !== "undefined"`**: os testes de Route Handler rodam em `@jest-environment node`,
onde `Element` não existe, e sem a guarda as 17 suítes de handler quebram na importação.

## Camada 6 — Usuários de uma company

- [x] Rota `/platform/companies/[companyId]/users`
- [x] Cabeçalho com o nome da company (`GET /api/platform/companies/:id`) e link "← Companies"
- [x] `<UsersScreen />` sob escopo do operador (`canManage` e `canIncludeDeleted` sempre verdadeiros)
- [x] 404 da company rende "not found" — **nunca** "existe em outro tenant"
- [x] **Verificar:** `npm test` verde (170 testes, 31 suítes)
- [x] Commit

## Camada 7 — Navegação e roteamento por papel

- [x] `NAV` ganha "Companies" para `ADMIN_MASTER`
- [x] "Account" escondido do operador — o `.env` do backend é a fonte da verdade da senha dele
- [x] `aria-current` por prefixo (`pathname === href || pathname.startsWith(href + "/")`)
- [x] `landingPath(role, next)` em `next-path.ts`, pura e testada
- [x] `proxy.ts`: quem tem sessão em `/login` vai para `/`, não para `/users`
- [x] `src/app/page.tsx`: RSC para "sem cookie → `/login`"; com cookie, `<SessionLanding />` despacha por papel
- [x] `FALLBACK` de `safeNextPath` vira `/`
- [x] **Verificar:** `npm test` verde (181 testes, 31 suítes)
- [!] **Verificação refeita.** O `npm run e2e` daquele commit rodou contra um `.next/standalone`
      **velho**: a suíte não constrói nada, ela sobe o artefato que já estiver lá. Refeito depois
      de `npm run build` na camada 8, com os 20 testes verdes
- [x] Commit

## Camada 8 — E2E

- [x] `fake-api.mjs`: login com `tenantDomain: "platform"` devolvendo `role: "ADMIN_MASTER"`
- [x] `fake-api.mjs`: companies em memória, semeadas pelo `POST /__reset`
- [x] `fake-api.mjs`: rotas `/platform/**` e guard de papel **nos dois sentidos**
- [x] `fake-api.mjs`: login recusa company com `isActive: false` com o 401 genérico — sem isso o
      teste de bloqueio não prova nada
- [x] `fake-api.mjs`: 404 no id do tenant de plataforma (o operador não pode se auto-desativar)
- [x] `e2e/platform.spec.ts`: operador entra → cria company → vê credenciais → bloqueia → o ADMIN
      daquela company toma 401 → desbloqueia → gerencia usuários → apaga com o nome digitado
- [x] **Verificar:** `npm run build && npm run e2e` verde — 20 testes
- [x] Commit

### Dois achados da suíte E2E

**`npm run e2e` não constrói nada.** Ele sobe o `.next/standalone` que já existir, então rodar sem
`npm run build` antes testa o código da última build — verde por engano. Vale para toda mudança de
`src/`.

**Os specs não podiam rodar em paralelo.** O dublê é um processo único com estado global, e todo
spec que o muta começa com `POST /__reset`. Dois arquivos em workers diferentes se atropelavam: o
reset de um apagava a sessão que o outro tinha acabado de abrir, e a falha aparecia como um login
que "não redirecionou". `playwright.config.ts` passa a fixar `workers: 1` e `fullyParallel: false`.

## Camada 9 — Fechamento

- [x] `documents/TESTE_MANUAL.md` — sai o `curl` para `/auth/register` (responde 404); entra o
      operador vindo de `ADMIN_MASTER_EMAIL`/`ADMIN_MASTER_PASSWORD` e o login com domínio `platform`
- [!] **Confirmar contra o backend real:** `PATCH /users/me/password` como `ADMIN_MASTER` responde
      403? E uma senha trocada pela API sobrevive ao restart? A tela de *Account* foi escondida do
      operador supondo que **não** sobrevive. Bloqueado: exige o NestJS, o Postgres e o Redis no ar,
      que não estão disponíveis aqui. Está no roteiro manual, e se a suposição estiver errada o item
      volta ao `NAV` do `app-shell.tsx`
- [x] `CLAUDE.md` — "Estado do repositório" e "Próximo passo"
- [x] Este checklist marcado
- [x] Commit

---

## Pendências e avisos

- [!] **Avisar o Bruno:** `FRONTEND_PLATFORM_SPEC.md` §3 diz que `role` só vale `ADMIN_MASTER` em
      `GET /auth/me`, mas o payload capturado em `backend/PLATFORM.md` mostra `POST /auth/login` do
      operador devolvendo `"role": "ADMIN_MASTER"` no corpo. A correção pertence ao repositório de
      origem. O frontend segue o payload capturado — é o que resolve o redirecionamento pós-login
      sem decodificar JWT nem buscar dado autenticado num Server Component.

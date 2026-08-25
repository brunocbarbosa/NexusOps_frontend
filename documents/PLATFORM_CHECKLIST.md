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

- [ ] `ASSIGNABLE_ROLES` (três) e `ROLES` (quatro) em `src/features/identity/types.ts`
- [ ] `AssignableRole` × `Role`; `isUserRole` → `isAssignableRole`
- [ ] `User.role: AssignableRole` — nenhuma listagem devolve `ADMIN_MASTER`
- [ ] `SessionUser.role: Role` e o `{ user }` de `useLogin()` com `Role` — os dois carregam o operador
- [ ] `role-badge.tsx` com quatro entradas (`ADMIN_MASTER` → "Platform operator")
- [ ] `users-toolbar.tsx` e `user-form-dialog.tsx` iterando `ASSIGNABLE_ROLES`
- [ ] `app-shell.tsx` com `NavItem.roles: readonly Role[]`
- [ ] `src/app/api/users/route.ts` usando `isAssignableRole`
- [ ] **Verificar:** `npm run typecheck` limpo
- [ ] **Verificar:** `npm test` verde
- [ ] Commit

## Camada 3 — Superfície do BFF

- [ ] `pickBooleans()` em `src/lib/api/payload.ts` (`isActive` é booleano; `pickStrings` não serve)
- [ ] `api/platform/companies/route.ts` — GET (query remontada campo a campo) e POST (corpo **aninhado**)
- [ ] `api/platform/companies/[companyId]/route.ts` — GET, PATCH, DELETE
- [ ] `api/platform/companies/[companyId]/users/route.ts` — GET, POST
- [ ] `api/platform/companies/[companyId]/users/[userId]/route.ts` — PATCH, DELETE
- [ ] `api/platform/companies/[companyId]/users/[userId]/restore/route.ts` — POST
- [ ] `isActive` na query só é encaminhado quando vale exatamente `"true"` ou `"false"` (ausente = os dois)
- [ ] `perPage` com teto 100 (101 é **400** no backend, não clamp)
- [ ] Um `route.test.ts` por handler (`@jest-environment node` + `cookie-jar`)
- [ ] **Verificar:** `npm test` verde
- [ ] **Verificar:** `npm run lint` limpo (roda `next typegen`, que gera os `RouteContext<>` novos)
- [ ] Commit

## Camada 4 — Escopo de usuários (refactor da fatia `identity`)

- [ ] `src/features/identity/users-scope.tsx` — `UsersScope`, `UsersScopeProvider`, `useUsersScope`
- [ ] `queries/users.ts` lendo o escopo; **assinaturas públicas dos hooks inalteradas**
- [ ] `queryKeyRoot` na chave de cache — sem ele, abrir a company A e depois a B mostra os usuários de A
- [ ] `UsersScreen` extraído de `users-page.tsx`; `UsersPage` vira casca com o escopo de identity
- [ ] `users-toolbar.tsx`: `isAdmin` → `canManage` / `canIncludeDeleted`
- [ ] `EmptyState` extraído para `src/components/empty-state.tsx`
- [ ] **Verificar:** `npm test` verde **sem editar** `users-page.test.tsx` nem `user-form-dialog.test.tsx`
      — é o critério de aceite do refactor
- [ ] **Verificar:** `npm run typecheck` limpo
- [ ] Commit

## Camada 5 — Tela de companies

- [ ] `npx shadcn@latest add checkbox` (não estava instalado)
- [ ] `src/features/platform/types.ts` — `Company`, `CompaniesPage`, `CompaniesQuery`, `CreateCompanyInput`, `CreateCompanyResult`
- [ ] `src/features/platform/queries/` — `platformKeys` e os hooks de company
- [ ] Listagem: busca com debounce 300 ms, filtro Active/Blocked/All, paginação de servidor
- [ ] Coluna Domain rende `—` quando `null` (o backend permite)
- [ ] **Checkbox "Active"**: não muta sozinho — abre `AlertDialog` que nomeia a company, e o diálogo
      **não fecha no erro** (`event.preventDefault()`)
- [ ] Criar company: um diálogo, duas seções (Company + Administrator) — a API recusa criar sem ADMIN
- [ ] Senha do ADMIN validada em **bytes** (reusar `validatePassword`/`passwordByteLength`)
- [ ] No 201, painel de credenciais que **só fecha por botão explícito** — não há convite nem reset
- [ ] Editar nome/domínio; 409 de domínio duplicado vira erro no campo
- [ ] `DELETE` num diálogo separado, exigindo digitar o nome da company, oferecendo bloquear como alternativa
- [ ] **Verificar:** `npm test` verde
- [ ] Commit

## Camada 6 — Usuários de uma company

- [ ] Rota `/platform/companies/[companyId]/users`
- [ ] Cabeçalho com o nome da company (`GET /api/platform/companies/:id`) e link "← Companies"
- [ ] `<UsersScreen />` sob escopo do operador (`canManage` e `canIncludeDeleted` sempre verdadeiros)
- [ ] 404 da company rende "not found" — **nunca** "existe em outro tenant"
- [ ] **Verificar:** `npm test` verde
- [ ] Commit

## Camada 7 — Navegação e roteamento por papel

- [ ] `NAV` ganha "Companies" para `ADMIN_MASTER`
- [ ] "Account" escondido do operador — o `.env` do backend é a fonte da verdade da senha dele
- [ ] `aria-current` por prefixo (`pathname === href || pathname.startsWith(href + "/")`)
- [ ] `landingPath(role, next)` em `next-path.ts`, pura e testada
- [ ] `proxy.ts`: quem tem sessão em `/login` vai para `/`, não para `/users`
- [ ] `src/app/page.tsx`: RSC para "sem cookie → `/login`"; com cookie, `<SessionLanding />` despacha por papel
- [ ] `FALLBACK` de `safeNextPath` vira `/`
- [ ] **Verificar:** `npm test` verde
- [ ] **Verificar:** `npm run e2e` verde (identity e smoke não podem regredir)
- [ ] Commit

## Camada 8 — E2E

- [ ] `fake-api.mjs`: login com `tenantDomain: "platform"` devolvendo `role: "ADMIN_MASTER"`
- [ ] `fake-api.mjs`: companies em memória, semeadas pelo `POST /__reset`
- [ ] `fake-api.mjs`: rotas `/platform/**` e guard de papel **nos dois sentidos**
- [ ] `fake-api.mjs`: login recusa company com `isActive: false` com o 401 genérico — sem isso o
      teste de bloqueio não prova nada
- [ ] `fake-api.mjs`: 404 no id do tenant de plataforma (o operador não pode se auto-desativar)
- [ ] `e2e/platform.spec.ts`: operador entra → cria company → vê credenciais → bloqueia → o ADMIN
      daquela company toma 401 → desbloqueia → gerencia usuários → apaga com o nome digitado
- [ ] **Verificar:** `npm run e2e` verde
- [ ] Commit

## Camada 9 — Fechamento

- [ ] `documents/TESTE_MANUAL.md` — sai o `curl` para `/auth/register` (responde 404); entra o
      operador vindo de `ADMIN_MASTER_EMAIL`/`ADMIN_MASTER_PASSWORD` e o login com domínio `platform`
- [ ] **Confirmar contra o backend real:** `PATCH /users/me/password` como `ADMIN_MASTER` responde
      403? E uma senha trocada pela API sobrevive ao restart? (a §6 da spec assume que não)
- [ ] `CLAUDE.md` — "Estado do repositório" e "Próximo passo"
- [ ] Este checklist marcado
- [ ] Commit

---

## Pendências e avisos

- [ ] **Avisar o Bruno:** `FRONTEND_PLATFORM_SPEC.md` §3 diz que `role` só vale `ADMIN_MASTER` em
      `GET /auth/me`, mas o payload capturado em `backend/PLATFORM.md` mostra `POST /auth/login` do
      operador devolvendo `"role": "ADMIN_MASTER"` no corpo. A correção pertence ao repositório de
      origem. O frontend segue o payload capturado — é o que resolve o redirecionamento pós-login
      sem decodificar JWT nem buscar dado autenticado num Server Component.

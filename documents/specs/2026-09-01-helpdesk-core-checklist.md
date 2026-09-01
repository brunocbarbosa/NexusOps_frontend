# Checklist — fatia `helpdesk`, o núcleo

Acompanha [`2026-09-01-helpdesk-core-design.md`](./2026-09-01-helpdesk-core-design.md).
Uma linha por task; marcar **depois** de a verificação daquela task passar, não antes.

Branch: `feat/helpdesk-core`, saída de `development`.

## Verificação de cada task

```
npm test -- <arquivo do teste da task>
npm run lint
npm run typecheck
```

## Tasks

- [x] **0 · Spec e checklist** — `documents/specs/2026-09-01-helpdesk-core-design.md` e este arquivo.
- [x] **1 · `PageMeta` para `src/lib/api/page.ts`** — mover de `features/identity/types.ts` e
      atualizar identity e platform. Critério: `npm test` passa **sem editar nenhum teste**.
- [x] **2 · Tipos, formato e mensagens** — `features/helpdesk/types.ts` (status, priority, category,
      `Ticket`, `Comment`, `AuditEntry`, `HistoryEntry`, `TicketsQuery`, mapa de transições legais),
      `format.ts` (rótulos e a frase de cada `AuditAction`) e `api-messages.ts`
      (`parseVersionConflict`). Testes primeiro para o mapa de transições e o parser.
- [x] **3 · Route Handlers de ticket** — `/api/tickets` (GET, POST), `/api/tickets/:id` (GET, PATCH),
      `/status`, `/assignee`, `/comments` (POST). Cada um com `route.test.ts`
      (`@jest-environment node`). Cobrir: `unassigned` × `assigneeId` nunca juntos, allowlist do
      corpo, `perPage` limitado a 100.
- [x] **4 · `/api/tickets/:id/history`** — a função de merge testada isolada (comentário sem entrada
      de auditoria, `commented` virando uma entrada só, ordem por `createdAt`, teto de páginas), e
      então o handler.
- [x] **5 · Hooks** — `queries/keys.ts`, `queries/tickets.ts` (`useTickets` infinita, `useTicket`,
      `useCreateTicket`, `useUpdateTicket`, `useChangeStatus`, `useAssign`), `queries/history.ts`,
      `queries/staff.ts`. Sem optimistic update; sucesso grava com `setQueryData`.
- [x] **6 · Tela `/tickets`** — toolbar com filtros e busca (debounce 300 ms), lista virtualizada com
      scroll infinito, `new-ticket-dialog`. Sem paginador e sem cabeçalho ordenável.
- [x] **7 · Tela `/tickets/:id`** — header, detalhes editáveis, ações do agente (status e assignee),
      compositor de comentário com o switch de nota interna, feed da timeline. 404 renderiza
      "Ticket not found", não um alerta.
- [x] **8 · O 409** — `version-conflict-dialog` e a integração nos três PATCH. Teste do ciclo
      completo: conflito → recarregar → reaplicar → versão avança um. Os outros três 409 caem em
      alerta inline.
- [x] **9 · Navegação** — item **Tickets** no `NAV` de `app-shell.tsx` (ADMIN, AGENT, REQUESTER) e
      `COMPANY_HOME` de `next-path.ts` passando de `/users` para `/tickets`. Atualizar
      `next-path.test.ts` e `app-shell.test.tsx`.
- [ ] **10 · Dublê e E2E** — `e2e/support/fake-api.mjs` com tickets, comentários e timeline,
      **incluindo** o 409 de versão com a versão atual na mensagem e a visibilidade por papel.
      `e2e/helpdesk.spec.ts` cobrindo a cadeia da §7 da spec.
- [ ] **11 · Documentação** — `CLAUDE.md` (estado do repositório, tabela de referência, próximo
      passo) e a seção de helpdesk em `documents/TESTE_MANUAL.md`.

## Verificação final da fatia

Nesta ordem — `npm run e2e` **não constrói nada**, então sem o `build` ele testa o artefato da última
build e passa verde por engano:

- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run e2e`

## Verificação manual, contra a API real

`NEXUSOPS_API_URL=http://localhost:3333` (backend na 3333, Next na 3000).

- [ ] `REQUESTER` abre um chamado, vê só os dele, e `/tickets/<id de outro>` mostra "Ticket not found".
- [ ] `AGENT` assume, move `OPEN → IN_PROGRESS → RESOLVED`; `RESOLVED → IN_PROGRESS` é recusado com o
      texto do backend num alerta inline.
- [ ] **O 409:** duas abas no mesmo chamado, a primeira salva, a segunda recebe o diálogo, reaplica, e
      a `version` avança exatamente um.
- [ ] Nota interna do agente não aparece na thread nem na timeline do requester.
- [ ] Chamado `CLOSED` recusa comentário novo, e a tela explica em vez de mostrar erro.
- [ ] Lista com 300+ chamados: o scroll carrega páginas e o DOM segura ~20 linhas.

### As três suposições da §4 da spec

- [ ] `PATCH /tickets/:id/status` exige `version`?
- [ ] `PATCH /tickets/:id/assignee` exige `version`?
- [ ] As transições legais são as quatro do mapa, e cada recusa vem como 409?

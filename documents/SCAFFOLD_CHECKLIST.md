# Checklist — Scaffold do frontend

Rastreia a execução da spec [`specs/2026-08-22-frontend-scaffold-design.md`](./specs/2026-08-22-frontend-scaffold-design.md).
Atualizado conforme cada tarefa termina. Uma tarefa só é marcada depois da verificação passar — não
depois do comando rodar.

**Legenda:** `[ ]` pendente · `[x]` concluída e verificada · `[!]` bloqueada (motivo ao lado)

---

## Camada 1 — Base Next.js

- [ ] `create-next-app` com TypeScript, App Router, `src/`, alias `@/*`, Tailwind
- [ ] `output: 'standalone'` em `next.config.ts`
- [ ] **Verificar:** `npm run dev` sobe sem erro
- [ ] **Verificar:** `npm run build` gera `.next/standalone`
- [ ] Commit

## Camada 2 — TypeScript e lint

- [ ] Fixar `typescript@6.0.3` (não o `latest` — ver §2.2 da spec)
- [ ] `strict: true` no `tsconfig.json`
- [ ] ESLint 10 flat config + `typescript-eslint` em modo type-checked
- [ ] **Verificar:** `npm run lint` limpo
- [ ] **Verificar:** regra com tipo realmente ativa (Promise flutuante é detectada)
- [ ] Commit

## Camada 3 — Estilo e Design System

- [ ] Confirmar Tailwind 4 operante (config CSS-first, sem `tailwind.config.js`)
- [ ] `shadcn init`
- [ ] Adicionar componente `button` como prova do pipeline
- [ ] `src/lib/utils.ts` com `cn()`
- [ ] **Verificar:** `npm run dev` renderiza o botão estilizado
- [ ] Commit

## Camada 4 — TanStack

- [ ] `@tanstack/react-query`
- [ ] `@tanstack/react-table` (declarada, sem uso ainda)
- [ ] `@tanstack/react-virtual` (declarada, sem uso ainda)
- [ ] `src/app/providers.tsx` com `QueryClientProvider`
- [ ] Provider montado no `layout.tsx`
- [ ] **Verificar:** `npm run build` passa com o provider montado
- [ ] Commit

## Camada 5 — Testes e hooks de commit

- [ ] Jest 30 via `next/jest`, ambiente `jsdom`
- [ ] RTL + jest-dom, `src/test/setup.ts`
- [ ] Teste de fumaça da home
- [ ] **Verificar:** `npm test` passa
- [ ] **Verificar:** teste único funciona (`npm test -- <arquivo>`)
- [ ] Playwright contra `build && start`, não `dev`
- [ ] Teste E2E de fumaça
- [ ] **Verificar:** `npm run e2e` passa
- [ ] Husky + Commitlint (Conventional Commits)
- [ ] **Verificar:** commit com mensagem inválida é barrado
- [ ] Commit

## Fechamento

- [ ] Atualizar a seção "Estado do repositório" do `CLAUDE.md` com os comandos reais
- [ ] Registrar desvios da spec, se houver
- [ ] Merge de `development` para `main`

---

## Registro de desvios

Divergências entre o que a spec previu e o que a execução exigiu. Vazio significa que a spec se
sustentou.

| Data | Camada | Desvio | Motivo |
| --- | --- | --- | --- |
| — | — | — | — |

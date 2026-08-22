# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado do repositório

O repositório ainda **não tem código**: apenas `LICENSE`, `README.md` e `documents/`. Não existe
`package.json`, nem toolchain de build/lint/teste instalada.

Consequência prática: **não há comandos de build, lint ou teste para rodar hoje**. Assim que o
scaffold do Next.js existir, esta seção deve ser substituída pelos comandos reais (incluindo como
rodar um único teste).

## Fluxo de branches

**`development` é a branch principal de trabalho.** Todo trabalho passa por ela.

- Parta de `development` para qualquer feature ou correção — nunca de `main`.
- **`main` só recebe código vindo de `development`**, nunca commits diretos e nunca merge de uma
  branch de feature. `main` é a linha de release.
- O `.claude/` é versionado neste repositório: skills e agents foram ajustados à stack decidida aqui,
  então reinstalá-los via `npx claude-code-templates` sobrescreve as customizações. Veja o commit
  `f3a3938` para o que foi removido e por quê.

## Documentos de referência

| Arquivo                                                                  | Leia antes de                                                     |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| [`documents/MAIN.md`](./documents/MAIN.md)                                | entender o objetivo geral do produto e os diferenciais técnicos    |
| [`documents/MAIN_FRONTEND.md`](./documents/MAIN_FRONTEND.md)              | qualquer decisão de stack ou estrutura de pastas                  |
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

Scaffold do Next.js + TypeScript, com Tailwind/Shadcn, TanStack Query, Husky e Commitlint. Ao fazê-lo,
atualizar a seção "Estado do repositório" desta página com os comandos reais de dev, build, lint,
teste unitário (e teste único) e E2E.

# NexusOps — Frontend

Documento de referência da stack e da arquitetura do frontend do NexusOps.
O objetivo geral do produto está em [`MAIN.md`](./MAIN.md); as decisões medidas do backend estão em
[`documents/backend/`](./backend/README.md).

## Stack em uma tabela

| Camada                | Escolha                                   | Papel                                                      |
| --------------------- | ----------------------------------------- | ---------------------------------------------------------- |
| Framework             | Next.js (React)                           | Roteamento avançado e build `standalone` para Docker leve   |
| Linguagem             | TypeScript                                | Tipagem estrita ponta a ponta, alinhada à API NestJS        |
| Estado de servidor    | TanStack Query                            | Cache, loading states e sincronização assíncrona            |
| Listas pesadas        | `@tanstack/react-virtual`                 | Virtualização (ex.: milhares de logs de auditoria)          |
| Estilo                | Tailwind CSS                              | Base do Design System, sem CSS do zero                      |
| Componentes           | Shadcn/ui (ou Radix UI)                   | Componentes acessíveis e padronizados                       |
| Data grids            | TanStack Table                            | Engine headless: ordenação e paginação das telas de listagem|
| Testes de unidade     | Jest + React Testing Library              | Comportamento, interação e acessibilidade dos componentes   |
| Testes E2E            | Playwright                                | Fluxos críticos em navegador headless na CI                 |
| Qualidade / CI        | Husky, Commitlint, SonarCloud             | Padronização local dos commits e validação na pipeline      |

---

## 1. Fundação e linguagem

- **React com Next.js** — framework principal, que traz o roteamento avançado e o build otimizado no
  modo `standalone`, para gerar uma imagem Docker leve e pronta para o deploy.
- **TypeScript** — garante a tipagem estrita de ponta a ponta, essencial para manter os contratos de
  dados seguros e alinhados com a API NestJS.

## 2. Gerenciamento de estado e performance

- **TanStack Query (React Query)** — ferramenta principal para gerenciar o *estado do servidor*,
  lidando com cache local, loading states e a sincronização assíncrona das rotas com o backend.
- **`@tanstack/react-virtual`** — peça fundamental para a performance: faz a virtualização de listas
  pesadas (como milhares de registros de logs de auditoria), renderizando apenas o que o usuário vê
  na tela, sem travar o navegador.

## 3. Interface e Design System

- **Tailwind CSS + Shadcn/ui (ou Radix UI)** — combinação para construir componentes acessíveis e de
  alto nível rapidamente, com foco em um Design System padronizado, sem perder tempo escrevendo CSS
  do zero.
- **TanStack Table** — engine headless avançada para as data grids complexas, com suporte a
  ordenação e paginação. É o coração das telas de listagem de chamados e de controle de ativos.

## 4. Testes e infraestrutura de CI/CD

- **Husky, Commitlint e SonarCloud** — o trio que garante a padronização dos commits locais e a
  validação de qualidade e segurança do código na pipeline.
- **Jest + React Testing Library (RTL)** — para testar comportamento, interações e acessibilidade dos
  componentes isolados no terminal.
- **Playwright** — para os testes E2E, rodando um navegador headless na integração contínua para
  simular fluxos críticos (como a abertura de um ticket).

---

## 5. Organização estrutural: separação por features

A organização do código é **por feature (domínio)**, não por tipo de arquivo.

**Alinhamento arquitetural.** O backend em NestJS foi estruturado separando os domínios de negócio em
módulos isolados, como `identity` (usuários e autenticação), `helpdesk` (chamados) e `auditing`.
Espelhar essa modularidade orientada a domínio (DDD) no frontend demonstra uma visão técnica coesa de
ponta a ponta.

**Manutenibilidade.** Para alterar a lógica de atualização ou renderização de um chamado, basta
acessar `features/tickets/`. Lá estão os componentes visuais, as requisições do TanStack Query, as
tipagens e os hooks específicos daquela funcionalidade — sem risco de quebrar outras partes do
sistema.

**Escalabilidade.** Evita o inchaço de diretórios globais, deixando claro que componentes complexos,
como a timeline de auditoria de um chamado, pertencem exclusivamente àquele domínio e não ao sistema
como um todo.

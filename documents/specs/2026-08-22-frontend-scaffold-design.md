# Spec — Scaffold do frontend NexusOps

**Data:** 2026-08-22 · **Branch:** `development` · **Status:** aprovado, aguardando implementação

Documento de design do scaffold inicial. O objetivo geral do produto está em
[`../MAIN.md`](../MAIN.md); a stack e a arquitetura em
[`../MAIN_FRONTEND.md`](../MAIN_FRONTEND.md). O progresso da execução é rastreado em
[`../SCAFFOLD_CHECKLIST.md`](../SCAFFOLD_CHECKLIST.md).

## 1. O que esta entrega é

Um scaffold com toolchain verde. Nada de tela de negócio.

**Critério de pronto** — todos os seis passam:

| Comando | Resultado esperado |
| --- | --- |
| `npm run dev` | página inicial estilizada, sem erro no console |
| `npm run build` | gera `.next/standalone` |
| `npm run lint` | limpo, com regras que usam informação de tipo ativas |
| `npm test` | 1 teste RTL passa |
| `npm run e2e` | 1 teste Playwright passa |
| `git commit -m "mensagem errada"` | **barrado** pelo commitlint |

## 2. Decisões tomadas

### 2.1 Arquitetura de autenticação: Next como BFF

O browser nunca fala com o NestJS diretamente. Route Handlers do Next fazem proxy, o access token
vive em cookie `httpOnly` e o refresh é serializado no servidor.

Três razões, todas ancoradas em `../backend/USERS.md`:

- **O refresh reusado revoga a família inteira de tokens.** Dois refreshes simultâneos derrubam a
  sessão do usuário. Serializar no servidor é estruturalmente mais simples que um mutex no cliente,
  que precisa sobreviver a múltiplas abas.
- **Cookie `httpOnly` é invisível ao JavaScript**, portanto imune a XSS. Token em memória não é.
- Server Components passam a poder buscar dados sem duplicar a lógica de autenticação.

**Isto é a arquitetura-alvo, não parte deste scaffold.** Ela se prova com a fatia de login. Construir
o proxy agora seria código sem consumidor.

### 2.2 TypeScript 6.0.3, não o `latest`

`typescript@7.0.2` é o `latest` do registry, mas `typescript-eslint@8.67.0` declara
`peerDependencies.typescript: ">=4.8.4 <6.1.0"`. Adotar o TS 7 desliga as regras de lint que dependem
de informação de tipo — `no-floating-promises` e `no-unsafe-assignment` entre elas, justamente as que
importam num cliente de API — e o projeto tem SonarCloud como gate de qualidade.

`6.0.3` é a versão mais alta dentro daquele range. Revisitar quando o typescript-eslint alcançar o
TS 7.

**Não usar `--legacy-peer-deps` para contornar isso.** Instalação forçada troca um erro visível por
um silencioso.

### 2.3 Versões

Todas verificadas no registry npm em 2026-08-22.

| Pacote | Versão | Observação |
| --- | --- | --- |
| `next` | 16.3.2 | App Router; `output: 'standalone'` |
| `react` / `react-dom` | 19.2.8 | |
| `typescript` | 6.0.3 | teto do typescript-eslint — ver 2.2 |
| `eslint` | ~~10.9.0~~ **9.39.5** | flat config — ver nota abaixo da tabela |
| `typescript-eslint` | 8.67.0 | modo *type-checked* |
| `tailwindcss` | 4.3.3 | config CSS-first, sem `tailwind.config.js` |
| `shadcn` (CLI) | 4.19.0 | escreve em `src/components/ui/` |
| `@tanstack/react-query` | 5.101.4 | |
| `@tanstack/react-table` | 9.1.2 | major novo; v8 terminou em 8.21.3 |
| `@tanstack/react-virtual` | 3.14.10 | |
| `jest` | 30.4.2 | via `next/jest` |
| `@playwright/test` | 1.62.1 | |

> **Correção de execução (2026-08-22).** O ESLint ficou em `9.39.5`, não `10.9.0`. Ver §6.

**Gerenciador de pacotes: npm.** É o único instalado no ambiente (Node 24.15.0, npm 11.12.1), e o
lockfile fixa o padrão para o repositório.

### 2.4 Estrutura de pastas

```
src/
  app/              # App Router — rotas e layouts
    layout.tsx
    page.tsx
    providers.tsx   # QueryClientProvider ('use client')
  features/         # espelha identity/helpdesk/auditing do NestJS
    README.md       # documenta a convenção
  components/ui/    # shadcn escreve aqui
  lib/utils.ts      # cn() do shadcn
  test/setup.ts     # jest-dom
e2e/                # Playwright, fora de src/
```

`src/` com alias `@/*`.

**As pastas `features/identity`, `features/helpdesk` e `features/auditing` não são criadas agora.**
Diretório vazio não sobrevive ao git, e diretório especulativo é convite a ser preenchido errado. O
`README.md` registra a convenção; a primeira feature real cria a sua própria pasta.

## 3. Execução em cinco camadas

Cada camada termina com verificação e **um commit próprio** — se algo quebrar, `git bisect` aponta a
camada em uma tentativa, em vez de deixar dez peças suspeitas ao mesmo tempo.

| # | Camada | Verificação de saída |
| --- | --- | --- |
| 1 | `create-next-app` (traz Tailwind 4) + `output: 'standalone'` | `build` gera `.next/standalone` |
| 2 | TS 6.0.3 + ESLint 9.39.5 flat config type-checked | `lint` limpo |
| 3 | `shadcn init` sobre o Tailwind da camada 1 + componente `button` | `dev` renderiza estilizado |
| 4 | TanStack Query/Table/Virtual + `providers.tsx` | `build` passa com o provider montado |
| 5 | Jest+RTL, Playwright, Husky+Commitlint | suítes verdes; commit inválido barrado |

Table e Virtual entram na camada 4 como dependência declarada, ainda sem uso — o uso chega com a
primeira listagem.

## 4. Testes

**Unidade.** `next/jest` para a transformação, ambiente `jsdom`, RTL com jest-dom. O teste de fumaça
renderiza a home e afirma um texto. Ele existe para provar que a cadeia funciona — transform, alias
`@/*`, jsdom, matchers — **não** para testar a página. Quando a home mudar, ele muda junto sem
cerimônia.

**E2E.** Playwright roda contra `next build && next start`, nunca contra `dev`: o servidor de
desenvolvimento compila sob demanda, o que introduz variação de tempo que vira flakiness na CI.

### 4.1 Scripts do `package.json`

| Script | Faz |
| --- | --- |
| `dev` | servidor de desenvolvimento |
| `build` | build de produção (`standalone`) |
| `start` | serve o build |
| `lint` | ESLint |
| `test` | Jest |
| `test:watch` | Jest em watch |
| `e2e` | Playwright |

**Teste único** (o `CLAUDE.md` pede este comando documentado):

```bash
npm test -- src/app/page.test.tsx
```

## 5. Fora de escopo

Explicitamente ausentes desta entrega: telas de negócio, cliente de API, Route Handlers do BFF,
Dockerfile, configuração do SonarCloud, React Compiler.

## 6. Riscos conhecidos

Quatro majors recentes conversando entre si — Next 16, ESLint 10, Jest 30 e TS 6.

- ~~`eslint-config-next` pode arrastar plugins que ainda não declaram suporte a ESLint 10.~~
  **Confirmado na execução (2026-08-22).** `eslint-plugin-react`, `eslint-plugin-import` e
  `eslint-plugin-jsx-a11y` param no `^9` em suas versões `latest` — não há para onde atualizar. O
  projeto fica em `eslint@9.39.5`, que carrega a dist-tag `maintenance` e portanto continua suportado.
  O objetivo da camada era lint com informação de tipo, e isso funciona no 9. Revisitar quando os três
  plugins alcançarem o ESLint 10.
- **`next/jest` com Jest 30** é a combinação menos exercitada do conjunto.

Se uma camada travar: parar e reportar, não forçar a instalação. Ver 2.2.

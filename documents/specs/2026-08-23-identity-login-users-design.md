# Fatia `identity`: login, sessão e usuários

**Data:** 2026-08-23 · **Estado:** implementado nesta branch · **Precede:**
[`2026-08-22-frontend-scaffold-design.md`](./2026-08-22-frontend-scaffold-design.md) §2.1

Esta é a primeira fatia de produto do frontend e existe para provar a arquitetura de BFF que o
scaffold decidiu e não construiu: o browser nunca fala com o NestJS, Route Handlers do Next fazem
proxy, os tokens vivem em cookie `httpOnly` e o refresh é serializado no servidor.

A interface é escrita em **inglês**; a documentação continua em português.

## 1. O que a fatia entrega

| Rota | Papel exigido | O que faz |
| --- | --- | --- |
| `/login` | público | entra com `company domain`, email e senha |
| `/users` | ADMIN, AGENT | lista com busca, filtro de papel, paginação; ADMIN cria, edita, desativa e restaura |
| `/account` | qualquer | troca a própria senha |
| `/` | — | redireciona para `/users` ou `/login` |

Fora de escopo, deliberadamente: `POST /auth/register` (não há tela de sign-up — o tenant de
desenvolvimento nasce por `curl`), CSP com nonce, e qualquer domínio que não seja `identity`.

## 2. A regra que organiza tudo

**Nenhum Server Component busca dado autenticado.**

Só Route Handler, Server Action e `proxy.ts` conseguem **gravar** cookie. Um RSC que precisasse
renovar a sessão gastaria o refresh token sem conseguir persistir o par rotacionado — e o token
velho, reapresentado na requisição seguinte, é exatamente o reuso que o backend trata revogando a
**família inteira** de tokens. O usuário seria deslogado por um detalhe de onde o `fetch` roda.

Daí a forma: os RSCs renderizam shell e layout, todo dado autenticado passa por um Route Handler, e
o cliente o consome via TanStack Query.

```
browser ──fetch /api/*──► Route Handler ──Bearer──► NestJS
                              │  401 → refresh single-flight → regrava cookies → repete 1×
                              └─ Set-Cookie httpOnly (nexusops_at / nexusops_rt)
```

## 3. Decisões

### 3.1 Um chokepoint para falar com a API: `apiFetch`

`src/lib/api/server.ts` é a única função que chama o NestJS autenticado. Lê o access token do
cookie, e no 401 renova, regrava os dois cookies e repete **uma única vez** — repetir mais entra em
laço. Se a renovação falha, limpa os cookies e devolve 401: a sessão acabou.

O motivo de ser um só lugar é o mesmo do backend com o filtro de tenant: um handler que monte a
requisição por conta própria é um handler que pode esquecer o `Bearer`, ou tentar renovar duas
vezes, ou vazar o token na resposta.

### 3.2 O refresh é serializado — e o voo em andamento não bastava

`refreshOnce(refreshToken)` guarda a promise em voo indexada pelo próprio token, para que duas
requisições concorrentes compartilhem uma única renovação. Isso resolve metade do problema, e a
outra metade **só apareceu contra o backend de verdade**.

O browser dispara `/api/auth/me` e `/api/users` juntas, mas elas não chegam juntas ao servidor. A
segunda pode chegar depois de a primeira já ter renovado — e ela ainda carrega o cookie **antigo**,
porque o `Set-Cookie` da primeira ainda não voltou. Com o mapa apagando a entrada no `finally`, essa
segunda requisição reapresentava um refresh token gasto, o backend classificava como reuso e
revogava a família inteira: **de cinco requisições concorrentes, uma passava e quatro tomavam 401 —
e a sessão do usuário morria**. O teste unitário original não pegava isso porque disparava as cinco
no mesmo instante; o mundo real as escalona.

A correção é lembrar do resultado por uma janela de 30 segundos: durante ela, o token antigo devolve
o par que a renovação anterior já obteve, em vez de bater na API outra vez. Não é um segundo login —
é exatamente o par que já está no cookie. A janela também limpa as entradas vencidas a cada
gravação, e há um teto de 500 para o caso de carga.

Um detalhe menor da mesma investigação: `readTokens()` normaliza cookie vazio para `undefined`.
`"" ?? fallback` continua sendo `""`, o que produzia uma chamada sem `Authorization` em vez de uma
renovação.

**Limitação consciente:** isto vale dentro de um processo. Com mais de uma instância do Next atrás de
um balanceador, duas instâncias ainda podem renovar o mesmo token e derrubar a sessão. Hoje roda uma
instância; escalar horizontalmente exige mover essa memória para um store compartilhado, e este
parágrafo é o lembrete de que a decisão é consciente.

### 3.3 A superfície do BFF é explícita, não um `[...path]`

Um catch-all republicaria a API inteira para o browser e apagaria a fronteira que a fatia existe
para desenhar. São sete handlers finos sobre `apiFetch`:

```
POST   /api/auth/login          → 200 { user }   (nenhum token chega ao browser)
POST   /api/auth/logout         → 204
GET    /api/auth/me             → 200 { id, tenantId, email, role }
GET,POST      /api/users
GET,PATCH,DELETE /api/users/:id
POST   /api/users/:id/restore
PATCH  /api/account/password    → 204
```

### 3.4 `proxy.ts`, não `middleware.ts`

O Next 16 depreciou `middleware.ts` e renomeou o arquivo para `proxy.ts`
(`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`).

Ele decide o acesso pela **presença** do cookie de refresh e não renova nada: a própria doc avisa
que o proxy pode rodar na CDN e não deve depender de módulo ou estado compartilhado — que é
justamente o que o `Map` do §3.2 é. Sem cookie de refresh, redireciona para `/login?next=...`; com
sessão, tira o usuário de `/login`.

Os cabeçalhos de segurança simples (`HSTS`, `X-Content-Type-Options`, `Referrer-Policy`,
`X-Frame-Options`, `Permissions-Policy`) saem daí. **CSP com nonce ficou de fora**: obriga
renderização dinâmica em toda página e merece uma fatia própria, medida sozinha.

### 3.5 O papel autoritativo vem de `/auth/me`, não do JWT

O backend relê a linha do usuário a cada requisição: um ADMIN rebaixado há trinta segundos já é
AGENT, mesmo com o access token dizendo o contrário por até 15 minutos. A UI nunca decodifica o JWT
— o que ela sabe sobre papéis vem de `GET /auth/me`.

### 3.6 Nenhuma dependência nova

Formulários com React 19 (`useActionState`, `useTransition`) e validadores próprios em
`features/identity/validation.ts`. A regra dos **72 bytes** de senha (bcrypt trunca em silêncio, e
um emoji custa quatro) é uma função de cinco linhas com `TextEncoder`, testada — não vale uma
biblioteca de schema.

Sem biblioteca de toast: o erro aparece inline no próprio diálogo, e o resultado da ação aparece na
tabela que o TanStack Query revalida.

### 3.7 A lista de usuários **não** é virtualizada

`GET /users` é paginado e o `perPage` tem teto de 100 no backend — um 400, não um clamp silencioso.
Virtualizar 20 linhas seria complexidade sem cliente. `@tanstack/react-virtual` continua reservado
para a timeline de auditoria, que é a lista que motivou a escolha.

## 4. Erros que viram comportamento de tela

O envelope do Nest é `{ message: string | string[], error?: string, statusCode }` — `message` é
array em falha de validação, e o 401 de token inválido vem **sem** a chave `error`. `ApiError`
normaliza os dois.

| Situação | O que a tela faz |
| --- | --- |
| 401 no login | `Invalid credentials`, sem insinuar qual campo falhou — o backend não diferencia, nem no tempo de resposta |
| 401 fora do login | os cookies já foram limpos pelo handler; a UI manda para `/login` |
| 403 | "You don't have permission", papel insuficiente |
| 404 | "not found" — nunca "existe em outro tenant"; é por isso que o backend responde 404 e não 403 |
| 409 `belongs to a deactivated user (<uuid>)` | o diálogo oferece **Restore this user**; o uuid sai da mensagem por `parseDeactivatedUserId` |
| demais 409 | a mensagem do backend é exibida como veio: já é boa e já está em inglês |

`retry` do TanStack Query passa a `false` para 4xx. Repetir um 409 sobrescreveria o trabalho de
outro analista, e repetir um 404 não muda a resposta.

## 5. Verificação

> **Nota de 2026-08-28.** Esta seção descreve o ambiente de 2026-08-23 e ficou desatualizada em dois
> pontos. O corpo abaixo fica como foi escrito — é o registro do que era verdade quando a fatia foi
> desenhada —, mas **não o siga**:
>
> - **As portas.** O backend passou a escutar na 3333, então não há mais disputa: `NEXUSOPS_API_URL`
>   aponta para `http://localhost:3333` e o Next fica na 3000, sem `PORT=3001`. Seguir a receita
>   antiga aponta o frontend para a própria porta dele, e o login falha com um 502 enganoso — hoje um
>   500, desde que `apiBaseUrl()` deixou de ter default.
> - **O `curl` de cadastro.** `POST /auth/register` foi removido do backend e responde 404, inclusive
>   com token válido. Companies nascem no console do operador, e o operador vem de
>   `ADMIN_MASTER_EMAIL`/`ADMIN_MASTER_PASSWORD` no `.env` do backend.
>
> O estado atual está no [`CLAUDE.md`](../../CLAUDE.md) e em
> [`TESTE_MANUAL.md`](../TESTE_MANUAL.md); o console do operador tem spec própria em
> [`2026-08-25-platform-operator-console-design.md`](./2026-08-25-platform-operator-console-design.md).

O backend e o Next disputam a porta 3000. Backend em 3000, Next em 3001 (`PORT=3001 npm run dev`),
com `NEXUSOPS_API_URL=http://localhost:3000`.

O tenant de desenvolvimento nasce por `curl`:

```bash
curl -X POST http://localhost:3000/auth/register -H 'content-type: application/json' \
  -d '{"tenantName":"Acme Inc","tenantDomain":"acme.com","email":"admin@acme.com","password":"correct horse battery"}'
```

O E2E do Playwright não precisa do backend: `e2e/support/fake-api.mjs` é um stub HTTP do NestJS que
sobe como segundo `webServer` e serve os mesmos formatos de resposta e de erro. Ele **rotaciona o
refresh token e revoga a família inteira em caso de reuso**, como o original — sem isso, o problema
do §3.2 não seria reproduzível fora da API real, e é o que sustenta o teste das cinco requisições
concorrentes.

Duas asserções que são o ponto da fatia: **nenhum token aparece em `document.cookie`**, e nenhuma
resposta de `/api/*` carrega `accessToken`.

E uma que nasceu na API real e hoje roda na CI: apagar o cookie de access, disparar cinco
requisições ao mesmo tempo e conferir que as cinco respondem 200 e que `GET /auth/me` continua
valendo. Foi o roteiro manual que reprovou a primeira versão do §3.2; depois que o dublê ganhou
rotação e detecção de reuso, o caso virou spec do Playwright — verificada nos dois sentidos, com e
sem a janela de tolerância.

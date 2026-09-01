# Fatia `helpdesk` — o núcleo: chamados, thread e o 409

**Data:** 2026-09-01 · **Estado:** em implementação · **Precede:**
[`2026-08-25-platform-operator-console-design.md`](./2026-08-25-platform-operator-console-design.md)

A interface é escrita em **inglês**; a documentação continua em português.

O contrato da API está em [`../backend/HELPDESK.md`](../backend/HELPDESK.md) — endpoints, payloads
capturados da aplicação rodando e o catálogo de erros. As decisões que o desenho do backend **obriga**
o cliente a tomar estão em [`../GUIA_FRONTEND_HELPDESK.md`](../GUIA_FRONTEND_HELPDESK.md). Esta spec
não repete nenhum dos dois: ela registra o que **este** frontend decidiu, e por quê.

## 1. Por que agora, e por que só uma parte

O helpdesk é onde três dos quatro diferenciais do [`MAIN.md`](../MAIN.md) aparecem na tela pela
primeira vez: o **409 de concorrência otimista** (B), a **timeline de auditoria** (D) e a
**virtualização da lista longa** (E). Até aqui eles eram promessa de documento.

A fatia inteira — chamados, comentários, trilha, relatórios assíncronos, socket e o feed `/audit`
do ADMIN — é grande demais para uma spec só, e o custo de empacotá-las juntas não é o tamanho do PR:
é que o 409, que é a tela mais importante do produto, competiria por atenção com o download de um
CSV. Então:

| Fatia | O que entra |
| --- | --- |
| **1 — o núcleo** (esta) | `/tickets` virtualizada, abrir chamado, `/tickets/:id` com thread e timeline, ações do agente, o diálogo de conflito |
| **2 — assíncrono** | `POST /reports/tickets` (202) → notificação → download, o socket, e o feed `/audit` |

A §7 fecha a decisão de transporte do realtime **agora**, porque ela restringe o desenho da fatia 1
e reabri-la depois custaria retrabalho.

## 2. A regra que organiza a fatia: visibilidade não é permissão

`GET /tickets/:id` devolve **200** para um agente e **404** para o colega de sala do requester. Não é
erro, é a regra de visibilidade — um `REQUESTER` só enxerga o que abriu.

Três consequências, e nenhuma delas é cosmética:

- **404 não renderiza "algo deu errado".** A tela mostra "Ticket not found" com caminho de volta para
  a lista. Um alerta genérico faz o usuário abrir um chamado reclamando de um chamado.
- **404 e 403 continuam sendo coisas diferentes.** 404 é "não existe *para você*" e não confirma que
  o id exista em algum lugar; 403 é "existe, e o seu papel não alcança esta ação". A UI trata os dois
  com telas distintas, como a fatia `identity` já faz.
- **Não existe seletor de "ver chamados de" para um requester.** O backend sobrescreve `?requesterId=`
  com o id de quem perguntou. Um controle que não muda nada é pior que controle nenhum.

O papel autoritativo continua vindo de `useSession()` (`GET /auth/me`), nunca do JWT: o backend relê
a linha do usuário a cada requisição.

## 3. Decisões

### 3.1 O 409 é a tela, não o tratamento de erro

Todo `PATCH` de ticket carrega a `version` **que a tela leu**. A fonte é o cache de
`['helpdesk','ticket',id]` — nunca um `useState` paralelo, que envelheceria em silêncio.

Quatro regras que caem daí:

- **Nada de optimistic update.** O ponto da coluna `version` é que o servidor decide quem ganhou;
  pintar a tela antes da resposta e desfazer depois é exatamente a experiência que ela existe para
  evitar.
- **Sucesso grava o retorno com `setQueryData`.** Toda resposta já traz a `version` nova, então isso
  evita um `GET` extra *e* deixa a próxima edição válida.
- **Nunca repetir a mesma requisição no 409.** A `version` continua velha e o retry só produz outro
  409.
- O 409 de versão **carrega a versão atual na mensagem**, de propósito, para a tela poder dizer o
  quanto se estava atrasado antes de recarregar.

**Nem todo 409 é conflito de versão** — e essa é a parte que uma implementação apressada erra. O
catálogo tem pelo menos quatro, com tratamentos diferentes:

| Mensagem do backend | O que a tela faz |
| --- | --- |
| `This ticket was changed by someone else (it is now at version N)…` | abre o diálogo de conflito |
| `A ticket cannot go from RESOLVED to IN_PROGRESS` | alerta inline no controle de status |
| `… is a REQUESTER and cannot be assigned a ticket…` | alerta inline no seletor de assignee |
| chamado `CLOSED` recusando comentário | compositor desabilitado, com a explicação |

Daí `parseVersionConflict(message): number | null`, irmão de `parseDeactivatedUserId` em
`identity/api-messages.ts` e pelo mesmo motivo: a mensagem carrega informação que a UI precisa, e
lê-la em um lugar só é o que impede quatro telas de discordarem. `null` significa "outro 409" e cai
no alerta inline.

O diálogo faz o que o guia pede, em três passos: recarrega o chamado, mostra **campo a campo** o que
o servidor tem agora contra o que se tentava salvar, e oferece **Reapply** (re-`PATCH` com a versão
nova) ou **Discard**. Ele não fecha sozinho no erro — fechar apagaria a mensagem que explica por que
nada aconteceu, como já vale para os diálogos de `identity`.

### 3.2 A lista é scroll infinito virtualizado, e isso exclui o paginador

`useInfiniteQuery` acumulando páginas de 50, com `@tanstack/react-virtual` sobre as linhas
acumuladas. É o cenário do ponto E do `MAIN.md` e o único lugar do produto onde a virtualização se
justifica de verdade — a tabela de usuários não é virtualizada justamente porque `perPage` para em
100 e 100 linhas não quebram o DOM.

O guia é explícito: **escolher um modo e não misturar**. Acumular páginas *e* oferecer paginador
confunde o `meta.total`. Então não há Previous/Next aqui, ao contrário de `/users`.

Duas coisas que a implementação não pode inverter:

- **Sem cabeçalho clicável para ordenar.** A ordenação não é configurável pelo cliente: a lista vem
  sempre do mais novo para o mais antigo e não existe parâmetro para isso. Um cabeçalho ordenável
  ordenaria só o que já foi carregado e mentiria para quem olha.
- **`columns` não pode depender de estado que chega tarde.** A armadilha já foi paga em
  `users-table.tsx`: recriar `columns` troca a identidade do `table` e do componente
  `table.FlexRender`, o React lê isso como outro tipo, desmonta a árvore e recria cada célula. Como
  `/auth/me` resolve **depois** da listagem, o que depende do papel é decidido *dentro* da célula.

O TanStack Table entra **headless**, só pelo modelo de colunas; as linhas são `div`s em CSS grid com
`role="grid"`/`row`/`gridcell`, porque linha posicionada em absoluto dentro de um `<tbody>` quebra o
layout de tabela.

`meta.total` vai no cabeçalho e pode ir direto: ele respeita visibilidade — o total de um requester
conta só os chamados dele.

Nos filtros, um detalhe que é 400 e não clamp: **`unassigned` e `assigneeId` se contradizem**. O
handler manda um ou outro, nunca os dois.

### 3.3 A timeline se junta no servidor

`GET /tickets/:id/timeline` traz o histórico **de mudanças**; `GET /tickets/:id/comments` traz os
**textos**. O backend não junta os dois de propósito — o corpo do comentário não pertence à trilha de
auditoria — e a ligação entre as listas é `newValues.commentId` nas entradas `commented` e
`internal_note_added`.

Fazer a intercalação no browser custaria duas `useInfiniteQuery` paginadas independentes e uma
máquina de estado para mantê-las alinhadas: para ordenar globalmente por `createdAt` é preciso ter as
duas listas inteiras, então "carregar mais" teria de avançar as duas em passo.

Em vez disso, **um Route Handler faz a junção**: `GET /api/tickets/:id/history` pagina as duas rotas
do NestJS com `perPage=100` (teto de 20 páginas por lista, para que um chamado patológico não vire
uma resposta sem limite), intercala por `createdAt` e devolve uma lista só. Isso cabe nas duas regras
da casa — o handler usa `apiFetch`, o único ponto que fala com o NestJS autenticado, e a tela recebe
tudo por TanStack Query — e deixa a função de merge pura e testável sozinha.

Três propriedades do merge, e a primeira é a que resolve um problema real:

- **Um comentário cuja entrada de auditoria ainda não chegou aparece assim mesmo.** A trilha é
  escrita *depois* da resposta, então um `GET` logo após um `POST` pode vir uma entrada atrás. Como o
  merge é por `createdAt` e o comentário é a fonte do texto, ele entra na hora; a entrada de
  auditoria, quando chegar, só acrescenta o autor formal.
- `commented` e `internal_note_added` viram **uma** entrada com o corpo, não duas.
- **Nada é filtrado no cliente.** Um `REQUESTER` nunca recebe `internal_note_added` nem o comentário
  correspondente — em nenhuma das duas rotas, nem no `total`. Refiltrar no browser seria manter uma
  segunda cópia de uma regra de visibilidade, e a cópia é o que sai do ar com o tempo.

### 3.4 A superfície do BFF, de novo explícita

Seis handlers finos sobre `apiFetch`, pelo mesmo motivo das duas fatias anteriores: um `[...path]`
republicaria a API inteira para o browser e apagaria a fronteira que o BFF existe para desenhar.

```
GET,POST  /api/tickets
GET,PATCH /api/tickets/:id
PATCH     /api/tickets/:id/status
PATCH     /api/tickets/:id/assignee
POST      /api/tickets/:id/comments
GET       /api/tickets/:id/history
```

`GET /api/tickets/:id/comments` **não existe**: quem lê a thread é `/history`, e uma segunda rota de
leitura seria uma segunda definição do que a tela mostra.

O corpo continua montado por allowlist (`pickStrings`) — o `ValidationPipe` do Nest roda com
`forbidNonWhitelisted`, então repassar o objeto recebido é 400 —, e a query string continua remontada
campo a campo pelo mesmo motivo.

### 3.5 `/tickets` é a casa de quem trabalha numa company

`landingPath` mandava todo não-operador para `/users`. Isso sempre foi errado para um `REQUESTER`,
que toma **403** ali: listar usuários é de ADMIN ou AGENT. Até agora o sintoma era abstrato porque um
requester não tinha nada mais a fazer no produto; com o helpdesk ele tem.

`COMPANY_HOME` passa a ser `/tickets`, e o item **Tickets** aparece no menu para os três papéis de
company. O operador continua sem ver nada disso: `ADMIN_MASTER` não tem chamados — a tabela de
visibilidade do backend diz "nothing", e não é uma restrição de papel, é que ele não pertence a
company nenhuma.

### 3.6 Um refactor pequeno, e só ele

`PageMeta` mora em `src/features/identity/types.ts`, mas é o envelope `{ data, meta }` de **toda**
listagem da API — não é do domínio identity. Vai para `src/lib/api/page.ts`. Sem isso, helpdesk
importaria o envelope global de dentro de outra feature, que é o tipo de dependência que parece
inofensiva até a terceira feature.

Nada mais de `identity` é tocado além disso e da §3.5. `User` continua lá: `requester`, `assignee` e
`closedBy` são `UserResponse`, que é dela.

## 4. Suposições declaradas

Três coisas que o desenho assume e que o roteiro manual confirma contra a API real. Estão aqui para
serem conferidas, não para serem esquecidas:

- **`PATCH /status` e `PATCH /assignee` também exigem `version`.** O guia diz "todo `PATCH` de ticket
  exige `version`"; a tabela de endpoints do `HELPDESK.md` não repete o campo rota a rota. O código
  envia: se não for exigido, sobra um campo; se for e faltar, é 400.
- **As transições legais** lidas do diagrama e do catálogo de erros: `OPEN → IN_PROGRESS | RESOLVED`,
  `IN_PROGRESS → RESOLVED | OPEN`, `RESOLVED → CLOSED | OPEN`, `CLOSED` terminal. A recusa de
  `RESOLVED → IN_PROGRESS` está capturada no `HELPDESK.md`; as outras são inferência do desenho.
- **O seletor de assignee tem teto de 100.** `useStaff()` pede `/api/users?role=ADMIN` e
  `?role=AGENT` com `perPage=100`. Uma company com mais de 100 de um papel só perde nomes da lista —
  lacuna conhecida, cuja saída é um combobox com busca no servidor.

## 5. Realtime: decidido agora, implementado na fatia 2

Registrado aqui para que a fatia 2 não reabra a discussão.

`socket.io` exige o access token em `auth` — o `WebSocket` do browser não permite header — e aqui o
access token vive num cookie `httpOnly` que o JS do browser não alcança. Por desenho: é o que faz um
XSS neste frontend não valer uma sessão. As três saídas:

| Caminho | Custo |
| --- | --- |
| Handler devolve o token e o browser conecta direto | fura o `httpOnly`; um XSS passa a valer 15 minutos de token, e ainda **não há CSP** neste projeto |
| Servidor Next intermedeia via SSE | uma conexão server-side por aba, e reconexão a cada renovação |
| Sem realtime | invalidação por TanStack Query; correto, só não é instantâneo |

**Escolhido: SSE por Route Handler.** `GET /api/realtime` responde `text/event-stream`; o servidor
Next abre o `socket.io-client` contra o NestJS com o token do cookie e repassa `ticket.changed` e
`report.*`. O token nunca chega ao browser e a regra "só Route Handler fala com o NestJS" fica
intacta. O handler reconecta depois de cada renovação — o papel é relido do banco no handshake, então
reconectar é o que aplica um papel que mudou — e usa `reconnection: false`, porque um socket recusado
por token expirado tentaria para sempre.

Enquanto isso não existe, a fatia 1 se vira com invalidação depois de cada mutação e
`refetchOnWindowFocus`.

## 6. Erros que viram comportamento de tela

Além do que `identity` já normaliza:

| Situação | O que a tela faz |
| --- | --- |
| 404 de chamado | "Ticket not found" com volta para a lista — **nunca** um alerta de erro |
| 403 em rota de staff | o `EmptyState` de papel insuficiente, como em `/platform/**` |
| 409 de versão | o diálogo de conflito (§3.1) |
| 409 de transição | alerta inline no controle de status, com o texto do backend |
| 409 de assignee inválido | alerta inline no seletor |
| 409 em chamado fechado | compositor desabilitado com explicação; a thread continua legível |
| 400 `unassigned and assigneeId contradict each other` | não acontece: o handler manda um ou outro |

## 7. Verificação

`npm test`, `npm run lint`, `npm run typecheck`, `npm run build` e então `npm run e2e` — nessa
ordem, porque **`npm run e2e` não constrói nada**: sem o build ele sobe o `.next/standalone` que já
existia e passa verde sobre o código de outro dia.

O dublê (`e2e/support/fake-api.mjs`) ganha tickets, comentários e timeline. Duas coisas nele não são
enfeite, pelo mesmo critério da fatia anterior:

- **O 409 de versão tem de ser real**: um `PATCH` com `version` velha responde 409 com a versão atual
  na mensagem. Sem isso, o teste do diálogo de conflito verifica que um modal abre, e não que o
  conflito foi resolvido.
- **A visibilidade tem de valer no dublê**: o chamado de outro requester responde 404, e a nota
  interna some da thread e do `total` para um `REQUESTER`. Um dublê que devolvesse tudo para todos
  ensinaria um comportamento que a API real não tem.

O E2E cobre a cadeia que é o ponto da fatia: requester abre um chamado → agente vê, assume e move o
status → nota interna que o requester não enxerga → duas edições concorrentes e o diálogo de
conflito → reaplicar e a versão avançar exatamente um.

O roteiro manual (`documents/TESTE_MANUAL.md`) ganha a seção de helpdesk, com as três suposições da
§4 como itens a confirmar.

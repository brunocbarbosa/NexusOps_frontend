# Fatia `platform`: o console do operador

**Data:** 2026-08-25 · **Estado:** em implementação · **Precede:**
[`2026-08-23-identity-login-users-design.md`](./2026-08-23-identity-login-users-design.md)

A interface é escrita em **inglês**; a documentação continua em português.

## 1. O que mudou no backend, e por que isso obriga uma fatia nova

`POST /auth/register` **foi removido**. Responde 404, e responde 404 com token válido também — a
rota não foi trancada, ela não existe. Nenhuma empresa se cadastra sozinha.

No lugar entrou um segundo tipo de usuário: o `ADMIN_MASTER`, **exatamente um** em toda a
instalação, semeado no boot a partir de `ADMIN_MASTER_EMAIL` e `ADMIN_MASTER_PASSWORD`. Ele cria as
companies junto do primeiro ADMIN de cada uma, gerencia os usuários dessas companies, e pode
bloqueá-las.

| Rota | Papel exigido | O que faz |
| --- | --- | --- |
| `/platform/companies` | ADMIN_MASTER | lista, cria (company + primeiro ADMIN), edita, bloqueia, apaga |
| `/platform/companies/:id/users` | ADMIN_MASTER | lista, cria, edita, desativa e restaura os usuários daquela company |

## 2. A decisão que organiza tudo: os papéis não são hierárquicos

O `RolesGuard` do backend checa **pertinência numa lista**, nunca uma ordenação. `ADMIN_MASTER` não
herda nada de `ADMIN`: ele toma **403 em `/users`**, e chega aos usuários de uma company por
`/platform/companies/:id/users` — que roda o mesmo serviço, dentro do escopo daquela company.

Daí a forma: **duas árvores de rota separadas**, não um console com telas a mais para quem tem mais
poder. O que as duas compartilham é o login, o shell, a mecânica de sessão e os componentes de
usuário. Construir uma hierarquia no cliente e supor que a API concorda produziria menus que levam a
403.

## 3. Decisões

### 3.1 Um login só, um despachante só

O operador entra pela mesma rota, com o domínio reservado `platform`. O backend não tem rota de
login separada, e o formulário é o mesmo.

O que ele ganha é uma **caixinha** ao lado de *Company domain*: marcar **trava** o campo e envia o
domínio reservado. Ela existe para ninguém ter de decorar a palavra `platform`, e trava em vez de só
preencher porque ali não vai o domínio de empresa nenhuma — o operador não pertence a uma. Marcada,
a validação de domínio some junto: cobrar preenchimento de um campo desabilitado seria cobrar o
impossível.

Um detalhe que morde: **campo desabilitado não entra no `FormData`**. O domínio reservado é
informado no `submit`, não lido do formulário — sem isso o corpo sairia sem `tenantDomain` e o
backend responderia 400.

O que muda é o destino. E ele não pode ser decidido onde seria natural: o `proxy.ts` só enxerga a
**presença** do cookie de refresh, e nenhum Server Component busca dado autenticado — um RSC que
renovasse a sessão gastaria o refresh token sem conseguir persistir o par rotacionado, e o token
velho reapresentado revoga a família inteira (§3.2 da fatia anterior).

Duas metades resolvem:

- **No login**, `POST /auth/login` já devolve o papel no corpo. `landingPath(role, next)` é uma
  função pura: operador com `?next=` fora de `/platform` vai para `/platform/companies`;
  não-operador com `next` dentro de `/platform` vai para `/users`; senão respeita o `next`. Sem
  isso, um ADMIN que fosse barrado em `/platform/companies` voltaria do login direto para um 403.
- **Na navegação direta para `/`**, o RSC continua mandando quem não tem cookie para `/login`; quem
  tem cookie recebe um client component que lê `useSession()` e despacha.

`proxy.ts` passa a mandar quem já tem sessão de `/login` para `/`, e o fallback de `safeNextPath`
vira `/`. **O `/` é o único despachante** — dois lugares decidindo divergiriam no primeiro papel
novo.

### 3.2 O papel novo separa exibir de atribuir

`USER_ROLES` virou duas constantes, porque as duas perguntas são diferentes:

- `ASSIGNABLE_ROLES` (ADMIN, AGENT, REQUESTER) — o que alimenta **todo `<Select>` de papel**, nos
  dois consoles, e o filtro `?role=`. Mandar `ADMIN_MASTER` é 400 em qualquer rota; o backend
  mantém a mesma lista em `src/users/assignable-role.ts`, e por trás dela um índice único parcial no
  PostgreSQL.
- `ROLES` (as quatro) — o que a UI precisa saber **exibir**: o badge, o filtro do menu, a guarda.

`User.role` é `AssignableRole` e `SessionUser.role` é `Role`. Nenhuma listagem devolve o operador —
ele não é staff de company nenhuma —, mas `/auth/me` e o login devolvem.

> `FRONTEND_PLATFORM_SPEC.md` §3 comenta que `ADMIN_MASTER` só aparece em `GET /auth/me`. O payload
> capturado em `backend/PLATFORM.md` mostra o login do operador devolvendo `"role": "ADMIN_MASTER"`
> no corpo. Seguimos o capturado, e é dele que a §3.1 depende.

### 3.3 A tela de usuários é reusada por escopo, não duplicada

`/platform/companies/:id/users` é quase idêntica a `/users`: mesmos payloads, mesmos 409, mesmo
diálogo que oferece restaurar. O que difere não é a apresentação — é de onde o dado vem e o que o
chamador pode fazer.

O acoplamento que impedia o reuso era que os diálogos chamam `useCreateUser()` e irmãos
**diretamente**, e esses hooks tinham `/api/users` escrito à mão. A saída é um contexto que os
próprios hooks leem:

```ts
interface UsersScope {
  basePath: string;                  // "/api/users" | "/api/platform/companies/<id>/users"
  queryKeyRoot: readonly unknown[];  // separa o cache de cada company
  canManage: boolean;
  canIncludeDeleted: boolean;
}
```

**As assinaturas públicas dos hooks não mudam.** `useUsers(query)` e `useCreateUser()` continuam
iguais, então os quatro componentes que os consomem mudam zero linhas — é o que torna barato mexer
numa fatia que já está em produção. O critério de aceite do refactor é a suíte de `identity` passar
**sem edição**.

`queryKeyRoot` está no escopo em vez de derivado do `basePath` de propósito: sem ele na chave, abrir
a company A e depois a B mostra os usuários de A.

`canIncludeDeleted` é separado de `canManage` porque no console da empresa eles coincidem (ambos são
"é ADMIN") e no do operador não têm relação nenhuma — um AGENT que pedisse `includeDeleted=true`
recebe 403, não a lista filtrada.

### 3.4 Bloquear e apagar são operações diferentes, e a tela tem de dizer isso

`PATCH { isActive: false }` **suspende**: todos os usuários daquela company são recusados no próximo
login com o 401 genérico, nenhuma linha de usuário é tocada, e `isActive: true` desfaz. É o que
"encerrar um cliente" deve significar na UI.

`DELETE` **destrói**: company, usuários, chamados, comentários e a trilha de auditoria inteira, por
cascade no banco. Não há rota de restauração e não há undo.

Por isso o checkbox "Active" fica na linha da tabela e o `DELETE` não: ele vive atrás de um diálogo
próprio que lista o que se perde e exige **digitar o nome da company**, oferecendo bloquear como
alternativa. Um ícone de lixeira ao lado de um switch convidaria ao erro que não tem volta.

O checkbox não muta sozinho: desmarcar abre uma confirmação que nomeia a company e explica o efeito.
E, como no diálogo de desativar usuário, ele **não fecha no erro** — fechar apagaria a mensagem que
explica por que nada aconteceu.

### 3.5 Criar company é um formulário só, com duas seções

A API recusa criar uma company sem ADMIN, e a recusa não é capricho: uma company sem ADMIN não pode
receber o primeiro usuário, ninguém consegue entrar nela, e a guarda do "último ADMIN" nunca poderia
ser satisfeita a partir do zero. Não há rota de saída desse estado, então ele não é alcançável.

Logo: um diálogo, seção "Company" e seção "Administrator", uma requisição.

**E o 201 não devolve token** — o operador criou a company, não virou administrador dela. Devolve as
credenciais, e não existe email de convite nem reset de senha. Por isso o diálogo troca para um
painel de resultado que **só fecha por botão explícito**: fechar sozinho no sucesso, como fazem os
outros diálogos, perderia a única exibição da senha.

A senha é validada em **bytes**, não caracteres — o bcrypt trunca no byte 72 em silêncio e um emoji
custa quatro. A função já existe em `identity/validation.ts`, testada.

### 3.6 A guarda de papel é um estado de tela, não um redirecionamento

Um ADMIN que abra `/platform/companies` recebe 403 e vê o mesmo `EmptyState` que a listagem de
usuários já usa. Redirecionar no cliente correria contra o `useSession()`, e mandaria embora sem
explicação quem foi rebaixado no meio da sessão — o backend relê o papel a cada requisição, então um
403 pode aparecer numa tela que estava funcionando.

O menu esconde o que sempre falharia; a autoridade continua sendo o backend.

### 3.7 "Account" não aparece para o operador

`PlatformBootstrapService` reconcilia email e senha do operador a partir do `.env` **a cada boot**, e
o `PLATFORM.md` diz que o `.env` é a fonte da verdade dos dois. Uma senha trocada pela API seria
revertida no próximo restart. Somado a `/users/me/password` viver sob `/users`, onde o operador toma
403, a tela não teria o que fazer.

É a única suposição desta fatia que não foi medida contra a API real. Está no roteiro manual para ser
confirmada.

### 3.8 A superfície do BFF continua explícita

Cinco handlers finos sobre `apiFetch`, pelo mesmo motivo da fatia anterior: um `[...path]`
republicaria a API inteira para o browser e apagaria a fronteira que o BFF existe para desenhar.

```
GET,POST         /api/platform/companies
GET,PATCH,DELETE /api/platform/companies/:companyId
GET,POST         /api/platform/companies/:companyId/users
PATCH,DELETE     /api/platform/companies/:companyId/users/:userId
POST             /api/platform/companies/:companyId/users/:userId/restore
```

`GET` de um usuário isolado fica de fora: a UI não usa.

Três detalhes que o padrão da fatia anterior não cobria:

- `pickStrings` não serve para `isActive`, que é booleano — daí `pickBooleans`, ao lado dele e pela
  mesma razão: o `ValidationPipe` do Nest roda com `forbidNonWhitelisted`, então repassar o objeto
  recebido é 400.
- O corpo de `POST /platform/companies` é **aninhado** (`admin: { email, password }`), e
  `pickStrings` é plano. Montado à mão.
- `isActive` na query só pode valer `"true"` ou `"false"`. **Ausente significa os dois**; `""` e
  `"all"` são 400. Só encaminhar quando o valor for exatamente um dos dois.

## 4. Erros que viram comportamento de tela

Além do que a fatia `identity` já normaliza:

| Situação | O que a tela faz |
| --- | --- |
| 403 em `/platform/**` | `EmptyState` "You don't have access to this page" — papel insuficiente, e só isso |
| 404 de company | "not found", **nunca** "existe em outro tenant" — o backend responde 404 justamente para não confirmar que o id existe em algum lugar |
| 409 `The domain "x" is already registered` | erro no campo domain, pedindo outro |
| 409 `belongs to a deactivated user (<uuid>)` | o diálogo já oferece **Restore this user** — herdado, funciona igual aqui |
| 409 do último ADMIN | mensagem do backend como veio: aponta promover alguém antes |
| 400 `perPage must not be greater than 100` | não acontece: o handler já limita. O backend **não** faz clamp silencioso |

## 5. Verificação

O dublê do Playwright (`e2e/support/fake-api.mjs`) ganha as rotas `/platform/**`, o login com
domínio `platform`, e o guard de papel **nos dois sentidos**. Duas coisas nele não são enfeite:

- **Login tem de recusar company com `isActive: false`**, com o mesmo 401 genérico. Sem isso, o teste
  de bloqueio verifica que um checkbox mudou de estado, e não que alguém deixou de conseguir entrar —
  que é a única coisa que o bloqueio significa.
- **O id do tenant de plataforma responde 404** nas rotas aninhadas. É o que impede o operador de se
  auto-desativar e deixar a instalação sem ninguém; um dublê que devolvesse 200 ali ensinaria um
  comportamento que a API real não tem.

O E2E cobre a cadeia inteira, porque é ela que é o ponto da fatia: entrar como operador → ver
"Companies" e não "Users" → criar company e ver as credenciais uma vez → bloquear → o ADMIN daquela
company tomar 401 → desbloquear → gerenciar os usuários → apagar digitando o nome.

O roteiro manual (`documents/TESTE_MANUAL.md`) perde o `curl` para `/auth/register`, que hoje
responde 404, e ganha o operador vindo do `.env` do backend.

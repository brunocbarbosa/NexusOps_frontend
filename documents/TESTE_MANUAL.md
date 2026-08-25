# Roteiro de teste manual — `identity` e `platform`

O que abrir, com que conta, e o que observar em cada tela. As contas abaixo vivem no **banco de
desenvolvimento** do backend; um `prisma:reset` leva as de company embora, e a seção
[Semear do zero](#semear-do-zero) recria em meio minuto. **O operador da plataforma não**: ele é
semeado do `.env` a cada boot e volta sozinho.

O desenho por trás do que este roteiro exercita está em
[`specs/2026-08-23-identity-login-users-design.md`](./specs/2026-08-23-identity-login-users-design.md)
e [`specs/2026-08-25-platform-operator-console-design.md`](./specs/2026-08-25-platform-operator-console-design.md).

> **`POST /auth/register` não existe mais.** Responde 404, inclusive com token válido. Companies
> nascem pelo console do operador — é a mudança que quebrou a versão anterior deste roteiro.

## Subir as duas pontas

As duas escutam na 3000 por padrão, então o frontend vai para a 3001.

```bash
# no repositório do backend
npm run infra:up && npm run start:dev        # http://localhost:3000

# aqui
cp .env.example .env.local                   # NEXUSOPS_API_URL=http://localhost:3000
PORT=3001 npm run dev                        # http://localhost:3001
```

`npm run dev` serve o desenvolvimento. Para exercitar exatamente o que a imagem Docker roda:
`npm run build && PORT=3001 NEXUSOPS_API_URL=http://localhost:3000 npm run start:standalone`.

## As contas

### O operador da plataforma

Não está em company nenhuma e **não nasce por `curl`**: `PlatformBootstrapService` o cria no boot a
partir de `ADMIN_MASTER_EMAIL` e `ADMIN_MASTER_PASSWORD` do `.env` do backend, e reconcilia os dois
a cada reinício. É por isso que ele não tem tela de *Account* — uma senha trocada pela API seria
revertida no próximo boot.

| Campo          | Valor                                              |
| -------------- | -------------------------------------------------- |
| Company domain | `platform` — literal, é o domínio reservado        |
| Email          | o de `ADMIN_MASTER_EMAIL` no `.env` do backend     |
| Senha          | a de `ADMIN_MASTER_PASSWORD`                       |

Existe **exatamente um**, sempre: um índice único parcial no PostgreSQL recusa o segundo.

### As contas de company

Todas no tenant **`acme.com`** — é o que vai no campo *Company domain* do login.

| Email                  | Senha                   | Papel     | O que a conta mostra                                                                 |
| ---------------------- | ----------------------- | --------- | ------------------------------------------------------------------------------------ |
| `admin@acme.com`       | `correct horse battery` | ADMIN     | tudo: criar, editar, desativar, restaurar e o switch *Show deactivated*               |
| `agent@acme.com`       | `another good password` | AGENT     | lista os usuários, mas sem *New user*, sem o switch e sem o menu de ações da linha    |
| `helpdesk@acme.com`    | `another good password` | AGENT     | segundo agente — dá o que filtrar em *Any role*                                       |
| `requester@acme.com`   | `another good password` | REQUESTER | o item *Users* some do menu; entrar em `/users` na mão dá "You don't have access…"    |
| `deactivated@acme.com` | —                       | REQUESTER | **desativado**: serve ao fluxo de restaurar, e o login dele responde o 401 de sempre  |

> Trocar a senha em *Account* **invalida a linha correspondente desta tabela** — o backend revoga
> todas as sessões e a senha antiga deixa de valer. Se fizer isso com o admin, anote a nova.

## O roteiro

### Login

- Senha errada → `Invalid credentials`. Domínio inexistente → **a mesma** mensagem. Usuário que não
  existe → a mesma. Conta desativada → a mesma. O backend não diferencia nem no tempo de resposta, e
  a tela não tenta ser mais esperta que ele.
- Deixe os campos vazios: a validação é local, e nada é enviado.
- Entre com `admin@acme.com`. Você cai em `/users`.
- Saia e entre como o operador, com o domínio `platform`. Você cai em **`/platform/companies`** —
  mesmo formulário, destino diferente. O menu mostra *Companies* e **não** mostra *Users* nem
  *Account*: os papéis não são hierárquicos, e ele toma 403 em `/users`.

### Papéis

- Saia e entre como `agent@acme.com`: a lista aparece, o botão *New user* não.
- Entre como `requester@acme.com`: *Users* some do menu lateral. Vá em `http://localhost:3001/users`
  na barra de endereço — a tela explica que a listagem é de admins e agentes, em vez de mostrar um
  erro cru. É um **403**, e é diferente de 404 de propósito.

### O console do operador

Entre com o domínio `platform`.

- **Bloquear.** Desmarque a caixinha *Active* da `Acme Inc`. Ela não muta no clique: confirma
  primeiro, e o texto diz que ninguém daquela empresa vai conseguir entrar e que dá para desfazer.
  Confirme, saia, e tente entrar como `admin@acme.com` → `Invalid credentials`, **a mesma** mensagem
  de senha errada. Uma empresa suspensa é indistinguível de um erro de digitação, de propósito.
  Volte como operador e remarque para devolver o acesso.
- **Criar company.** *New company* pede empresa e primeiro administrador no mesmo formulário — a API
  recusa criar uma sem ADMIN, porque nela ninguém entraria e ninguém criaria o primeiro usuário. No
  sucesso o diálogo mostra as credenciais e **não fecha sozinho**: não há email de convite nem reset
  de senha, então é a única vez que aquela senha aparece. Copie e entre com ela noutra aba.
- **Domínio repetido.** Tente criar outra com `acme.com` → `The domain "acme.com" is already
  registered`. Tente com o domínio `platform` → 400, ele é reservado.
- **Usuários de uma company.** Menu de ações da linha → *Manage users*. É a mesma tela de `/users`,
  com o nome da company no topo. O operador cria, edita, desativa, restaura e enxerga desativados
  sempre — ele não é ADMIN de company nenhuma, e restaurar exige achar primeiro.
- **Apagar.** *Delete permanently* exige **digitar o nome** da company e oferece bloquear no meio do
  caminho. Some com usuários, chamados e auditoria por cascade, sem restore e sem undo — só faça
  numa company descartável.
- **403 como estado.** Ainda logado como `admin@acme.com`, digite `/platform/companies` na barra de
  endereço: a tela explica que aquilo é do operador, em vez de mostrar erro cru. E como operador,
  `/users` faz o mesmo no sentido contrário.

**A confirmar contra a API real:** `PATCH /users/me/password` como `ADMIN_MASTER` responde 403? E
uma senha trocada por lá sobrevive ao restart? A tela de *Account* foi escondida dele supondo que
**não** — se estiver errado, o item volta ao menu.

### O 409 que tem saída

Como `admin@acme.com`:

1. *New user* → email `deactivated@acme.com` → qualquer senha → *Create user*.
2. O erro não é um beco sem saída: vem com o botão **Restore this user**, porque o backend devolveu o
   id do usuário desativado justamente para isso. Um endereço de um desativado continua ocupado — não
   dá para criar um substituto, e restaurar traz a mesma conta com o histórico dela.
3. Restaure e ligue *Show deactivated* para ver o antes e o depois.

### Os 409 que não têm

Ainda como admin, e nos dois casos o diálogo **fica aberto** com a mensagem do backend:

- desativar a si mesmo → `You cannot deactivate yourself. Ask another ADMIN to do it.`
- editar o próprio papel para Agent → `The last active ADMIN cannot be demoted. Promote another user first.`

### Senha é contada em bytes

Em *Account*, o texto embaixo do campo diz `x of 72 bytes`. Cole um emoji e veja pular de quatro em
quatro: o bcrypt ignora em silêncio tudo depois do byte 72, então contar caracteres deixaria passar
uma senha que vale muito menos do que parece.

Concluir a troca desloga na hora e manda para o login com um aviso — é honesto, porque o backend
acabou de revogar todas as sessões.

### A prova da arquitetura

Isto é o que a fatia existe para demonstrar:

- DevTools → Application → Cookies: os dois `nexusops_*` estão marcados como **HttpOnly**.
- No console, `document.cookie` **não** mostra nenhum deles — o JavaScript da página não alcança a
  sessão, e por isso um XSS não a rouba.
- Aba Network: nenhuma resposta de `/api/*` carrega `accessToken` ou `refreshToken`. O browser fala
  com os Route Handlers do Next; quem fala com o NestJS é o servidor.

### Renovação, sem esperar 15 minutos

Apague **só** o cookie `nexusops_at` (DevTools → Cookies → botão direito → Delete) e navegue ou
recarregue. Nada acontece na tela: o servidor renova a sessão sozinho e o valor de `nexusops_rt`
muda. Um refresh token reapresentado revogaria todas as suas sessões, então essa renovação é
serializada de propósito — ver §3.2 da spec.

## Semear do zero

Depois de um `prisma:reset`, com o backend no ar:

```bash
# 1. a company e o primeiro ADMIN nascem juntos, e agora quem os cria é o operador.
#    Pela UI: entre com o domínio `platform` e use *New company*. Por curl:
OP=$(curl -s -X POST http://localhost:3000/auth/login -H 'content-type: application/json' \
  -d '{"tenantDomain":"platform","email":"'"$ADMIN_MASTER_EMAIL"'","password":"'"$ADMIN_MASTER_PASSWORD"'"}' \
  | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

curl -s -X POST http://localhost:3000/platform/companies -H "authorization: Bearer $OP" \
  -H 'content-type: application/json' \
  -d '{"name":"Acme Inc","domain":"acme.com","admin":{"email":"admin@acme.com","password":"correct horse battery"}}'

# 2. um token de admin **da company** para as chamadas seguintes — o do operador
#    recebe 403 em /users, porque os papéis não são hierárquicos
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login -H 'content-type: application/json' \
  -d '{"tenantDomain":"acme.com","email":"admin@acme.com","password":"correct horse battery"}' \
  | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

# 3. as outras quatro contas
for entry in 'agent@acme.com AGENT' 'helpdesk@acme.com AGENT' 'requester@acme.com REQUESTER' 'deactivated@acme.com REQUESTER'; do
  set -- ${=entry}   # em bash, use: set -- $entry
  curl -s -X POST http://localhost:3000/users -H "authorization: Bearer $TOKEN" \
    -H 'content-type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"another good password\",\"role\":\"$2\"}" -o /dev/null -w "$1 -> %{http_code}\n"
done

# 4. e uma delas desativada, para o fluxo de restaurar
ID=$(curl -s "http://localhost:3000/users?search=deactivated" -H "authorization: Bearer $TOKEN" \
  | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
curl -s -X DELETE "http://localhost:3000/users/$ID" -H "authorization: Bearer $TOKEN" -o /dev/null -w "desativado -> %{http_code}\n"
```

O `set -- ${=entry}` é sintaxe do zsh (o shell deste ambiente): o zsh não divide expansão em
palavras sem o `${= }`. Em bash, `set -- $entry`.

## Sem backend nenhum

`npm run e2e` não precisa de nada disso: o Playwright sobe o artefato standalone **e**
`e2e/support/fake-api.mjs`, um dublê que serve os mesmos caminhos, códigos e envelopes de erro,
para os dois consoles. É o que roda na CI. O que ele não substitui é este roteiro — foi contra a
API real que apareceu o problema de renovação descrito na spec.

> **Rode `npm run build` antes.** A suíte E2E não constrói nada: ela sobe o `.next/standalone` que
> já estiver lá. Sem o build, você testa o código da última vez que alguém buildou — e passa verde
> por engano.

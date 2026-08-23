# Entendendo a pipeline de CI/CD do NexusOps

Documento de **estudo**, não de referência. A referência é
[`../specs/2026-08-22-cicd-security-design.md`](../specs/2026-08-22-cicd-security-design.md), que
registra as decisões de forma seca. Aqui o objetivo é outro: explicar do zero o que foi construído,
por que cada peça existe e o que cada ferramenta enxerga.

Se você só quer saber o que fazer no dia a dia, o resumo é: **abra um PR para `development`, espere
os dez checks ficarem verdes, faça o merge.** O resto deste documento explica o que acontece por
baixo disso.

---

## 1. O problema que CI/CD resolve

Imagine o projeto sem pipeline nenhuma. Você escreve código, roda `npm test` na sua máquina, vê
verde, e faz commit. Três coisas podem dar errado, e as três já aconteceram em projetos reais:

1. **Você esqueceu de rodar alguma coisa.** Rodou o teste, mas não o lint. Ou rodou os dois, mas não
   o build de produção.
2. **Funciona na sua máquina e não na de outro.** Você tem um arquivo gerado que não está no git,
   uma variável de ambiente configurada há seis meses, uma versão diferente do Node.
3. **Ninguém percebeu que quebrou.** O código entrou na branch principal e só se descobre o problema
   uma semana depois.

**CI — Integração Contínua** — é a resposta para os três: um computador limpo, que não é o seu, roda
todos os comandos a cada mudança proposta e diz se passou. Como ele parte de um clone vazio do
repositório, ele descobre a diferença entre "está no meu disco" e "está versionado".

> **Isto não é teoria.** Nesta entrega, o `npm run typecheck` passava na minha máquina e falhava na
> CI com `Cannot find name 'LayoutProps'`. O motivo era exatamente o caso 2: o Next gera um arquivo
> de tipos que o `.gitignore` exclui, e na minha máquina ele existia porque eu já tinha rodado
> `npm run build` antes. Num clone limpo, não. A CI encontrou em minutos algo que ficaria escondido
> até o próximo desenvolvedor clonar o projeto.

**CD — Entrega Contínua** — é o passo seguinte: quando tudo passa, o mesmo computador **empacota** o
que foi aprovado e publica em algum lugar de onde dá para instalar. Aqui esse pacote é uma imagem
Docker.

---

## 2. O mapa: o que existe neste repositório

```
.github/
  workflows/
    ci.yml            <- o portão de qualidade
    security.yml      <- as varreduras de segurança
    release.yml       <- empacota e publica a imagem
  dependabot.yml      <- robô que atualiza dependências
  CODEOWNERS          <- quem é dono de qual pasta
  pull_request_template.md

Dockerfile            <- receita da imagem de produção
.dockerignore         <- o que NÃO entra na imagem
sonar-project.properties  <- o que o SonarCloud analisa
scripts/setup-branch-rulesets.sh  <- aplica as regras de branch no GitHub
.nvmrc                <- a versão do Node, em um lugar só
SECURITY.md           <- como reportar uma vulnerabilidade
```

Nada disso existia antes desta entrega. O projeto já tinha testes (Jest, Playwright) e hooks de
commit (Husky, Commitlint), mas tudo rodando **só na máquina do desenvolvedor**.

---

## 3. GitHub Actions: o vocabulário

O GitHub Actions é a plataforma que roda a CI. Ele não é um programa que você instala — é um serviço
do próprio GitHub. Você escreve arquivos YAML em `.github/workflows/` e ele os executa.

Quatro palavras, do maior para o menor:

| Palavra | O que é | Exemplo aqui |
| --- | --- | --- |
| **Workflow** | um arquivo `.yml`. Tem um nome e uma lista de gatilhos | `CI`, `Security`, `Release` |
| **Job** | uma tarefa independente dentro do workflow. Cada job roda numa **máquina virtual limpa e própria** | `quality`, `e2e`, `sonar` |
| **Step** | um passo dentro do job. Ou roda um comando, ou usa uma *action* | `npm ci`, `npm run lint` |
| **Action** | um bloco pronto que alguém publicou, reutilizável | `actions/checkout` |

### Jobs são isolados — isso importa mais do que parece

Cada job começa numa máquina virtual **vazia**. Ele não vê os arquivos que outro job baixou, nem as
dependências que outro instalou. É por isso que quase todo job aqui começa com os mesmos três
passos:

```yaml
- uses: actions/checkout@v7      # baixa o código do repositório
- uses: actions/setup-node@v7    # instala o Node
- run: npm ci --ignore-scripts   # instala as dependências
```

Parece repetição desnecessária, mas é o preço do isolamento. A vantagem: jobs rodam **em paralelo** e
uma falha aponta o culpado com precisão. Se `quality` falha e `e2e` passa, você já sabe que o
problema é de lint, tipo ou teste unitário, e não do build.

Quando um job **precisa** do resultado de outro, você declara com `needs:`. Aqui só um caso:
`sonar` tem `needs: quality`, porque consome o relatório de cobertura que o `quality` produz.

### Gatilhos: quando o workflow roda

```yaml
on:
  pull_request:
    branches: [development, main]   # quando abre/atualiza um PR que MIRA essas branches
  push:
    branches: [development, main]   # quando um commit chega nessas branches
  workflow_dispatch:                # botão manual na interface do GitHub
  schedule:
    - cron: "17 4 * * 1"            # toda segunda, 04:17 UTC
```

O `schedule` é o mais interessante e é a razão de a segurança ter workflow próprio: **uma
vulnerabilidade nova é publicada sem ninguém fazer commit.** Um workflow que só roda em push jamais
a encontraria. O agendamento semanal reexamina o código parado.

> O minuto `17` não é enfeite: às `00` todo mundo agenda, e o GitHub enfileira.

### Runner

A máquina virtual que executa o job. `runs-on: ubuntu-latest` pede um Linux hospedado pelo GitHub.
Ele nasce, roda os steps, e é destruído. Nada persiste entre execuções — exceto o que você
explicitamente salvar (cache ou artefato).

---

## 4. Workflow 1 — `CI`, o portão de qualidade

Cinco jobs. Cada um responde por um tipo de erro diferente.

### `quality` — o código está bem escrito?

```
npm ci → npm run lint → npm run typecheck → npm run test:coverage
```

- **lint** (ESLint): estilo e padrões perigosos. Neste projeto o ESLint usa *informação de tipo*, o
  que permite regras como `no-floating-promises` — uma `Promise` que ninguém aguardou. É a falha mais
  cara num cliente de API: a requisição falha, ninguém trata, e a tela segue como se tivesse dado
  certo.
- **typecheck** (`tsc --noEmit`): o TypeScript confere os tipos sem gerar arquivo nenhum.
- **test:coverage** (Jest): roda os testes unitários e mede **cobertura** — quanto do código foi
  executado pelos testes.

No fim, o job **sobe o arquivo de cobertura como artefato**:

```yaml
- uses: actions/upload-artifact@v7
  with:
    name: coverage
    path: coverage/lcov.info
```

**Artefato** é um arquivo que sobrevive ao fim do job e pode ser baixado por outro. É assim que o
`sonar` reaproveita a cobertura em vez de rodar a suíte de testes de novo.

### `e2e` — a aplicação funciona de verdade?

```
npm ci → npm run build → instala o Chromium → npm run e2e
```

Teste **end-to-end**: sobe a aplicação de verdade e um navegador de verdade (sem interface gráfica,
"headless"), clica e verifica. Diferente do teste unitário, que testa uma peça isolada.

Um detalhe de desenho: o build é um **step com nome próprio**, e não parte do comando de teste. Se o
build quebra, o GitHub mostra "Build" em vermelho — e não "E2E", que faria você procurar o problema
no lugar errado.

### `commits` — as mensagens de commit seguem o padrão?

O projeto usa **Conventional Commits**: `feat:`, `fix:`, `docs:`, `ci:`, `chore:`. Já existia um hook
local (`commit-msg`) que verificava isso.

**Por que repetir na CI, se o hook já faz?** Porque hook local se contorna com `git commit
--no-verify`. E porque o hook não existe para quem clonou e não rodou `npm install`. Na CI, não tem
saída.

### `branch-policy` — o PR vem da branch certa?

Este job é um **script de shell de dez linhas**, não uma action pronta:

```bash
if [ "$BASE" = "main" ] && [ "$HEAD" != "development" ]; then
  echo "::error::main so recebe PR vindo de development"
  exit 1
fi
```

`exit 1` reprova o job. O `::error::` é uma sintaxe especial que faz a mensagem aparecer destacada na
interface do GitHub.

**Por que isso existe?** A regra do projeto é: `main` só recebe código vindo de `development`. O
GitHub sabe exigir "precisa de PR" e "precisa de checks verdes", mas **não sabe expressar "de qual
branch o PR pode vir"**. Essa metade da regra não tinha onde morar, então virou código.

Foi testado de verdade: abri um PR de rascunho de uma branch qualquer direto para `main`, e ele
reprovou com a mensagem certa. Um guard que nunca reprovou não é um guard verificado.

### `sonar` — a análise de qualidade externa

Explicado na seção 8, que é grande o suficiente para ter uma seção só.

---

## 5. Workflow 2 — `Security`, quatro camadas que enxergam coisas diferentes

Esta é a parte que mais confunde no início, porque parece que as quatro ferramentas fazem a mesma
coisa. Não fazem. **Cada uma olha para um lugar diferente.**

| Ferramenta | O que ela lê | Que tipo de problema encontra |
| --- | --- | --- |
| **CodeQL** | o **seu** código-fonte | falhas de lógica: dado do usuário chegando num lugar perigoso |
| **Dependency Review** | o **diff** do `package-lock.json` | *este PR* está adicionando uma dependência vulnerável |
| **npm audit** | a lista **inteira** de dependências | qualquer dependência já instalada tem CVE conhecida |
| **gitleaks** | o **histórico do git** | senha ou token commitado, mesmo que num commit antigo |

### CodeQL — análise estática (SAST)

É uma ferramenta do próprio GitHub. Ela transforma seu código numa espécie de **banco de dados** e
roda consultas em cima dele. Uma consulta típica pergunta: *"existe algum caminho por onde um dado
que veio do usuário chega até uma execução de comando sem passar por validação?"* Isso se chama
**análise de taint** (rastreamento de contaminação).

Duas configurações valem entender:

- `build-mode: none` — para JavaScript/TypeScript o CodeQL lê o fonte direto, sem precisar compilar.
- `queries: security-extended` — o conjunto padrão é conservador. Este inclui consultas de precisão
  média: encontra mais, com mais falsos positivos. Foi escolhido porque o código que vem a seguir
  neste projeto é justamente cliente HTTP e manipulação de cookie de autenticação.

### Dependency Review — só faz sentido em PR

Ela compara o `package-lock.json` **antes e depois** do PR. Se o PR adiciona uma dependência com CVE
alta, ou com licença proibida, reprova.

Ela é a única que consegue dizer **"este PR introduziu isto"**. As outras só sabem dizer "isto
existe".

```yaml
fail-on-severity: high
deny-licenses: GPL-2.0, GPL-3.0, AGPL-3.0
```

A restrição de licença tem motivo concreto: GPL numa dependência de frontend distribuído contamina o
produto inteiro, e o NexusOps é MIT.

> Esta ferramenta exige que o **Dependency graph** esteja ligado no repositório. Não estava, e o job
> falhava com `Dependency review is not supported on this repository`. Foi preciso ligar nas
> configurações de segurança do GitHub.

### npm audit — partido em dois de propósito

```yaml
- run: npm audit --omit=dev --audit-level=high     # bloqueia
- run: npm audit --audit-level=moderate            # só informa
  continue-on-error: true
```

Por que dois comandos? Porque **dependência de produção e dependência de desenvolvimento não têm o
mesmo peso**:

- Uma CVE no `next` vai para dentro da imagem Docker e roda em produção. Bloqueia.
- Uma CVE no `playwright` só existe na máquina de teste. É dívida a agendar, não motivo para travar o
  merge de uma tela.

Tratar as duas como a mesma coisa leva a um de dois erros: ou você trava merges por causa de
ferramenta de build, ou você baixa o nível das duas e deixa passar o que importa.

`continue-on-error: true` faz o step rodar e reportar sem reprovar o job.

### gitleaks — varredura de segredos

Procura padrões que parecem credencial: chave de AWS, token do GitHub, chave privada. E procura no
**histórico inteiro**, não só no diff — por isso o `fetch-depth: 0`.

**Por que o histórico?** Porque um segredo vazado quase nunca está no diff atual. O caminho típico é:
alguém commitou um `.env` por engano, percebeu, apagou no commit seguinte. O arquivo sumiu do estado
atual, mas **continua no histórico do git**, e num repositório público continua acessível para
qualquer um.

---

## 6. Workflow 3 — `Release`, empacotar e publicar

Este é o "CD". Roda no push de `main` (que, pela política, só acontece por merge de PR aprovado) e
publica uma **imagem Docker** no **GHCR** (GitHub Container Registry — o "armazém" de imagens do
próprio GitHub).

### O que é uma imagem Docker

Um pacote que contém a aplicação **e** tudo de que ela precisa para rodar: o Node, os arquivos, as
variáveis. Quem recebe a imagem não precisa instalar nada — só `docker run`. É a resposta definitiva
para "na minha máquina funciona".

### Dockerfile em três estágios, e por quê

```dockerfile
FROM node:24-alpine AS deps      # 1. instala dependências
FROM node:24-alpine AS builder   # 2. roda o build
FROM node:24-alpine AS runner    # 3. só o resultado
```

Esse padrão se chama **multi-stage build**. A ideia: os dois primeiros estágios são descartados, e só
o terceiro vira a imagem final. Assim as ferramentas de build (compilador, dependências de
desenvolvimento) não viajam para produção.

**Resultado: 67 MB.** Se copiássemos `node_modules` inteiro, seriam centenas.

Por que separar `deps` de `builder`? Por causa do **cache de camadas**. O Docker guarda o resultado de
cada instrução e reaproveita enquanto a entrada não muda. Como o estágio `deps` copia **só** o
`package.json` e o `package-lock.json`, ele só refaz o `npm ci` quando uma dependência muda de
verdade — editar um `.tsx` não invalida o cache.

### Três linhas do Dockerfile que carregam armadilhas

```dockerfile
COPY --from=builder /app/.next/static ./.next/static
```
O `next build` com `output: standalone` **não** copia os arquivos estáticos (CSS, chunks de JS) para
dentro do pacote. Sem essa linha, o container sobe, responde `200`, e serve a página **sem CSS
nenhum**. Um teste que só verifique texto passa verde. Foi por isso que o teste E2E deste projeto
verifica o `font-size` computado, e não só o texto.

```dockerfile
ENV HOSTNAME=0.0.0.0
```
O servidor do Next, sem essa variável, escuta em `localhost`. Dentro de um container, `localhost`
significa "só eu mesmo" — o mapeamento de porta devolve *connection refused*. `0.0.0.0` significa
"aceite de qualquer interface".

```dockerfile
RUN npm ci --ignore-scripts
```
Explicado na seção 10.

### Usuário não-root

```dockerfile
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 --ingroup nodejs nextjs
USER nextjs
```

Por padrão um container roda como `root`. Se alguém explorar uma falha na aplicação, já entra com
privilégio máximo. Rodar como usuário comum limita o estrago.

### Attestation de proveniência

```yaml
- uses: actions/attest-build-provenance@v4
```

Gera uma assinatura criptográfica dizendo: *"esta imagem foi construída por este repositório, neste
workflow, a partir deste commit."* Serve contra ataque de cadeia de suprimentos — alguém publicar uma
imagem maliciosa com o mesmo nome.

---

## 7. Segredos e variáveis no GitHub

Duas caixas diferentes, e confundi-las custa tempo:

| | **Secret** | **Variable** |
| --- | --- | --- |
| Pode ser lido depois de salvo? | **não**, nem por você | sim |
| Aparece no log? | não (o GitHub mascara com `***`) | sim |
| Para quê | senha, token, chave | configuração comum |
| Como usar no YAML | `${{ secrets.NOME }}` | `${{ vars.NOME }}` |

Neste projeto:

- `SONAR_TOKEN` → **secret** (é uma credencial)
- `SONAR_ENABLED`, `SONAR_ORGANIZATION`, `SONAR_PROJECT_KEY` → **variables**

> **Armadilha real:** secrets e variables pertencem a **um repositório específico**. Eles estavam
> criados no repositório do *backend*, e por isso o job `sonar` do frontend simplesmente não rodava.
> Não há herança entre repositórios de uma conta pessoal.

O `SONAR_ENABLED` funciona como um interruptor:

```yaml
if: vars.SONAR_ENABLED == 'true'
```

Sem ele, alguém que clonasse o projeto (um *fork*) veria o job reprovar por falta de credencial — o
que parece falta de qualidade, mas é falta de configuração. São coisas diferentes e devem falhar de
formas diferentes.

---

## 8. SonarCloud — a análise de qualidade

### O que é

Um serviço externo. A CI envia o código e o relatório de cobertura; ele analisa e devolve um
veredito. Ele mede:

- **Bugs** — código que provavelmente está errado
- **Vulnerabilidades** — código inseguro
- **Code smells** — código que funciona mas é difícil de manter
- **Cobertura** — quanto do código os testes executam
- **Duplicação** — trechos copiados e colados

### Quality Gate

Um conjunto de condições. Se qualquer uma falhar, o gate reprova. As condições daqui:

```
new_reliability_rating      = 1   (A)
new_security_rating         = 1   (A)
new_maintainability_rating  = 1   (A)
new_coverage               >= 80%
new_duplicated_lines_density < 3%
new_security_hotspots_reviewed = 100%
```

Note o prefixo **`new_`** em todas. Isso é o conceito de **New Code**, e é a ideia mais útil do
SonarCloud.

> Uma condição só é avaliada quando faz sentido. Num PR que só mexe em `.md`, `new_coverage` e
> `new_duplicated_lines_density` nem aparecem no resultado — não há código novo para medir. Isso é
> visível na API: o PR #5 (que mexia em workflow) devolve seis condições; o #6 (só documentação)
> devolve quatro.

### New Code: por que medir só o código novo

Se o gate exigisse 80% de cobertura no projeto **inteiro**, um projeto legado com 20% jamais
conseguiria passar, e o gate viraria ruído que todo mundo ignora.

Medindo só o que mudou, a regra fica exequível: *"o que você está acrescentando agora tem que estar
bom"*. Com o tempo, o projeto inteiro melhora — sem nunca ter exigido um mutirão.

### Duas coisas que enganam

**1. O scan não reprova nada.** Ele só envia o relatório e sai com código 0, mesmo com o gate
vermelho. Quem reprova é um segundo passo:

```yaml
- uses: SonarSource/sonarqube-scan-action@...    # envia
- uses: SonarSource/sonarqube-quality-gate-action@...  # espera o resultado e reprova
```

Sem o segundo, o job fica **verde para sempre**, e você acharia que tem um gate quando não tem.

**2. `fetch-depth: 0` não é otimização.** Por padrão o `actions/checkout` baixa só o último commit
(*shallow clone*), o que é mais rápido. Mas o Sonar precisa do **histórico completo** para saber quais
linhas são novas. Sem ele a análise sai mesmo assim — **medindo a coisa errada**, que é pior do que
não sair.

### `sonar-project.properties`

```properties
sonar.sources=src,Dockerfile,.github,scripts
sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.exclusions=src/components/ui/**
```

`sonar.sources` diz o que analisar. Repare que **não é só `src`**: o Sonar tem analisadores próprios
para Dockerfile, workflows do GitHub Actions e shell. Na primeira execução, `sonar.sources` era só
`src`, e o log dizia `no files to be analyzed` para os três — ou seja, **a pipeline estava fora da
análise de qualidade que ela mesma executava**.

`sonar.exclusions` tira `src/components/ui/**` da análise: são componentes gerados pelo shadcn, que o
CLI reescreve a cada atualização. Medir dívida técnica em código que você não escreveu e não pode
consertar não informa nada.

### O que aconteceu quando o Sonar passou a enxergar a pipeline

O gate reprovou com **16 vulnerabilidades**, todas nos próprios arquivos de CI/CD. Todas legítimas.
Vale estudar as três categorias:

**Actions presas por tag, e não por commit.** `uses: docker/login-action@v4` aponta para uma *tag*,
que é um ponteiro móvel: quem controla aquele repositório pode reapontar `v4` para outro código — que
então roda com o `GITHUB_TOKEN` do seu projeto. A correção é fixar o hash do commit:

```yaml
uses: docker/login-action@dbcb813823bdd20940b903addbd779551569679f # v4.6.0
```

O comentário preserva a legibilidade e o Dependabot ainda consegue atualizar.

**`npm ci` sem `--ignore-scripts`.** Explicado na seção 10.

**`permissions` no topo do workflow.** Dar permissão no nível do workflow é dar aquele escopo a
**todos** os jobs. O correto é cada job declarar o mínimo de que precisa. Só o job que publica a
imagem tem `packages: write`.

---

## 9. Dependabot — o robô que atualiza dependências

Configurado em `.github/dependabot.yml`. Toda segunda ele confere se há versões novas e abre PRs.

Três configurações que valem entender:

```yaml
target-branch: development
```
**Sem isso, o Dependabot abriria PR contra a branch padrão do repositório, que é `main`** — violando a
política de release logo na primeira atualização.

```yaml
groups:
  react:
    patterns: ["react", "react-dom", "@types/react", "@types/react-dom"]
```
Sem agrupamento, seriam quatro PRs para a mesma atualização do React. Agrupado, é um só.

```yaml
ignore:
  - dependency-name: typescript
    update-types: ["version-update:semver-major"]
```
O TypeScript está **fixado de propósito** em 6.0.3: o `typescript-eslint` declara compatibilidade
`<6.1.0`, e subir para o TS 7 **desliga silenciosamente** todas as regras de lint que usam informação
de tipo. Um PR do Dependabot subindo esse major passaria verde e enfraqueceria o lint sem ninguém
notar. Por isso o major fica fora do automático.

---

## 10. `--ignore-scripts`: uma lição de cadeia de suprimentos

Quando você roda `npm ci`, o npm executa **scripts de instalação** (`postinstall`) das dependências —
e das dependências das dependências. Isso é código arbitrário rodando na sua máquina de build, com
acesso à rede e ao sistema de arquivos.

É o caminho mais curto de um ataque de cadeia de suprimentos: alguém compromete um pacote pequeno,
publica uma versão com `postinstall` malicioso, e ele roda em toda CI que instalar aquela árvore.

`--ignore-scripts` desliga isso.

**Mas será que quebra alguma coisa?** Essa é a pergunta certa, e a resposta não se descobre lendo. O
que foi feito:

```bash
# 1. quais pacotes da árvore têm script de instalação?
# resposta: um só, o unrs-resolver

# 2. clone limpo, instalação sem scripts, e roda tudo
npm ci --ignore-scripts
npm run lint && npm run typecheck && npm test && npm run build
```

Passou nos quatro. Só então a mudança entrou. **Medir antes de mudar** é o padrão que este projeto
segue em toda decisão de infraestrutura.

---

## 11. Rulesets — transformando a regra em bloqueio

Até aqui, todos os checks eram *informativos*: apareciam vermelhos, mas nada impedia o merge. E push
direto em `main` funcionava normalmente.

**Ruleset** é o mecanismo do GitHub que transforma regra em bloqueio. Aplicado por
`scripts/setup-branch-rulesets.sh`:

| Regra | `development` | `main` |
| --- | --- | --- |
| Precisa de PR | sim | sim |
| Checks obrigatórios | 8 | 7 |
| Force push | bloqueado | bloqueado |
| Deletar a branch | bloqueado | bloqueado |
| Histórico linear | — | sim |

Testado por comportamento, não por existência:

```
remote: error: GH013: Repository rule violations found for refs/heads/main.
remote: - Changes must be made through a pull request.
remote: - 8 of 8 required status checks are expected.
```

### Três detalhes com raciocínio por trás

**Zero aprovações obrigatórias.** O GitHub não deixa o autor aprovar o próprio PR. Como o projeto tem
um mantenedor só, exigir uma aprovação trancaria **todo** merge. O que segura a qualidade aqui são os
checks obrigatórios, não a contagem de revisores.

**O admin mantém uma saída de emergência** (`bypass_actors`). Sem ela, uma CI quebrada bloquearia o
commit que conserta a CI.

**Check pulado conta como aprovado.** Esta é sutil e vale decorar: um job que o `if` pula reporta
`conclusion=skipped`, e o **GitHub trata `skipped` como satisfeito** num check obrigatório.

A consequência: exigir um check que nunca roda é pedir **verde por ausência**. Foi por isso que:
- `dependency-review` ficou **fora** das duas listas (só roda em PR; num push de merge nunca
  reportaria);
- `sonar` está na lista de `development` mas **não** na de `main`, porque ele pula nos PRs para
  `main`.

---

## 12. As armadilhas que só a execução revelou

Esta é a seção mais útil para estudar, porque mostra **como se diagnostica**, não só o que deu certo.

### `LayoutProps` não existe na CI

**Sintoma:** `npm run typecheck` verde na máquina, vermelho na CI com
`error TS2304: Cannot find name 'LayoutProps'`.

**Diagnóstico:** reproduzi o ambiente da CI — clonei o repositório numa pasta limpa e rodei. Falhou
igual. Isso já provava que era diferença de ambiente, não de código.

**Causa:** `LayoutProps` é um tipo que o Next **gera** em `.next/types`, e o `next-env.d.ts` está no
`.gitignore`. Na minha máquina existiam porque eu já tinha rodado `build`. Num clone limpo, não.

**Correção:** `"typecheck": "next typegen && tsc --noEmit"`. A correção foi no `package.json`, e não
no workflow, para que **o comando da CI continue idêntico ao comando local** — que é justamente a
propriedade que tornou a diferença visível.

### O 403 do SonarCloud (e dois diagnósticos errados)

**Sintoma:** o passo do Quality Gate falhava com `curl: (22) The requested URL returned error: 403`.
O scan em si passava.

**Primeira hipótese (errada):** o SonarCloud classificava `development` como branch de vida curta, e
branch curta não teria gate. Mudamos a classificação para longa. **O erro continuou idêntico** — o
log mudou, o 403 não. Foi isso que derrubou a hipótese.

**Segunda hipótese (errada):** forçar `-Dsonar.pullrequest.base=main`. O SonarCloud **ignorou** o
parâmetro (ele lê o alvo do PR pela integração com o GitHub) e ainda quebrou o scan, porque informar
esse parâmetro desliga a auto-configuração dos outros.

**Causa real:** estava no *corpo* da resposta, que eu não tinha lido:

```
Organization is not allowed to access data from PR targeting non main branches
```

O plano do SonarCloud só serve dados da **branch principal do projeto**. Como essa branch era `main`,
todo PR de feature (que mira `development`) era recusado.

**Correção:** tornar `development` a branch principal **no SonarCloud** — é ela que recebe todo PR de
feature, portanto é o recorte que precisa ser legível.

**A lição de método:** o código de status HTTP raramente diz a causa. `403` é só "recusado". O corpo
da resposta dizia exatamente qual era o problema, em inglês claro, desde a primeira tentativa.

### `main` na proteção de branch responde 404

**Sintoma:** com os rulesets ativos e recusando push de verdade,
`gh api repos/.../branches/main/protection` respondia `404 Branch not protected`.

**Causa:** *branch protection* clássica e *ruleset* são **mecanismos diferentes**. O endpoint antigo
não enxerga rulesets. O critério de verificação que eu tinha escrito no checklist daria **falso
negativo numa configuração funcionando**.

**Correção:** verificar com `gh api repos/.../rules/branches/main`.

---

## 13. Como ler uma falha de CI

Um método que funciona, na ordem:

1. **Qual job falhou?** O nome já restringe: `quality` é lint/tipo/teste; `e2e` é build ou navegador;
   `sonar` é qualidade externa.
2. **Qual step dentro do job?** A interface do GitHub marca o step em vermelho. Steps depois dele
   aparecem como *skipped*.
3. **Leia a mensagem inteira, não só a última linha.** No caso do SonarCloud, a última linha era
   `exit code 22` — inútil. A causa estava no corpo da resposta HTTP.
4. **Reproduza localmente, no ambiente mais parecido possível.** Clone limpo se você suspeita de
   arquivo não versionado. Docker se suspeita do empacotamento.
5. **Se a correção não muda o sintoma, a hipótese estava errada.** Não empilhe correções — desfaça a
   que não funcionou. Foi assim que as duas hipóteses erradas do SonarCloud caíram.

Comandos úteis:

```bash
gh pr checks <numero>              # estado dos checks de um PR
gh run list --branch <branch>      # execuções recentes
gh run view <id> --log-failed      # só o log do que falhou
gh run rerun <id> --failed         # reexecuta só os jobs vermelhos
```

---

## 14. Glossário

| Termo | Significado |
| --- | --- |
| **CI** | Integração Contínua: validar automaticamente cada mudança |
| **CD** | Entrega Contínua: empacotar e publicar o que foi aprovado |
| **Workflow** | um arquivo YAML em `.github/workflows/` |
| **Job** | tarefa dentro de um workflow, em máquina virtual própria |
| **Step** | passo dentro de um job |
| **Action** | bloco reutilizável publicado por alguém |
| **Runner** | a máquina virtual que executa o job |
| **Artefato** | arquivo salvo por um job, que outro pode baixar |
| **Secret** | valor sensível, mascarado no log, não relegível |
| **Variable** | configuração comum, visível |
| **SAST** | análise estática de segurança — lê o código sem executá-lo |
| **CVE** | identificador público de uma vulnerabilidade conhecida |
| **Quality Gate** | conjunto de condições que reprova ou aprova a análise |
| **New Code** | recorte do que mudou, em vez do projeto inteiro |
| **Cobertura** | percentual do código executado pelos testes |
| **Ruleset** | regras do GitHub que bloqueiam push e merge |
| **GHCR** | GitHub Container Registry — onde a imagem é publicada |
| **Multi-stage build** | Dockerfile com estágios descartáveis, para imagem menor |
| **Cadeia de suprimentos** | ataque que vem por uma dependência, não pelo seu código |
| **Shallow clone** | clone só do commit mais recente, sem histórico |

---

## 15. O que a pipeline ainda **não** faz

Registrado para você não achar que está completo:

- **Não faz deploy.** Publica a imagem no GHCR, mas nada a consome ainda — não há servidor,
  Kubernetes ou serviço apontando para ela.
- **Nunca publicou nada de fato.** O workflow `Release` dispara no push de `main`, e até 2026-08-23
  nenhum merge `development → main` aconteceu. A imagem foi construída e validada **localmente**.
- **Não versiona automaticamente.** Tags `v1.0.0` são criadas à mão.
- **Não tem cabeçalhos de segurança HTTP** (CSP, HSTS). CSP com Next exige *nonce* por requisição e
  pertence ao `middleware.ts`, que chega junto com a fatia de login.
- **Não roda E2E contra a imagem Docker**, só contra o artefato local. É o mesmo código, mas não o
  mesmo empacotamento.

---

## 16. Para se aprofundar

Dentro do próprio repositório:

- [`../specs/2026-08-22-cicd-security-design.md`](../specs/2026-08-22-cicd-security-design.md) — as
  decisões e as alternativas que foram **descartadas**, com o motivo de cada uma
- [`../CICD_CHECKLIST.md`](../CICD_CHECKLIST.md) — o registro de execução e a tabela de desvios
- [`../../CLAUDE.md`](../../CLAUDE.md) — a seção "Coisas que mordem"
- Os próprios arquivos em `.github/workflows/` — os comentários explicam o porquê de cada bloco

Documentação oficial:

- GitHub Actions — https://docs.github.com/actions
- SonarQube Cloud — https://docs.sonarsource.com/sonarqube-cloud/
- Rulesets — https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets
- Docker multi-stage — https://docs.docker.com/build/building/multi-stage/

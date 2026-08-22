# Imagem de produção do frontend NexusOps.
#
# Depende de `output: 'standalone'` em next.config.ts: o Next emite em
# .next/standalone um server.js com apenas as dependências que ele realmente
# resolve, o que dispensa copiar node_modules para a imagem final.
#
# A versão do Node vem do .nvmrc — mantida aqui como ARG para não haver duas
# fontes de verdade se alguém subir o major.
ARG NODE_VERSION=24

# ---------------------------------------------------------------------------
# deps — instala com o lockfile e nada mais, para o cache de camada só invalidar
# quando package.json ou package-lock.json mudarem, não a cada edição de código.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS deps
# O SWC do Next é um binário nativo linkado contra glibc; no Alpine ele precisa
# do shim do libc6-compat para carregar.
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
# `--ignore-scripts` fecha o caminho mais curto de um comprometimento de cadeia
# de suprimentos: um `postinstall` de dependência transitiva rodando com a rede
# e o sistema de arquivos do build. Verificado que lint, typecheck, testes e
# build passam sem os scripts — o único pacote da árvore que tem `postinstall`
# é o `unrs-resolver`, e o ESLint funciona sem ele.
RUN npm ci --ignore-scripts

# ---------------------------------------------------------------------------
# builder — roda o next build
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------------------------------------------------------------------------
# runner — só o artefato
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# O server.js do standalone escuta em localhost quando HOSTNAME não é definido;
# dentro de um container isso responde apenas a si mesmo e o mapeamento de porta
# devolve connection refused.
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs

# public/ vem antes dos artefatos do build porque muda menos.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# O `next build` NÃO copia os estáticos para dentro do standalone. Sem esta
# linha o container sobe, responde 200 e serve a página sem CSS nem chunks de
# JS — a mesma armadilha que scripts/start-standalone.sh existe para evitar.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# Sem curl na imagem: o fetch global do Node 24 resolve sem instalar pacote.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]

#!/usr/bin/env bash
# Sobe o artefato standalone — exatamente o que a imagem Docker executa.
#
# O `next build` NÃO copia os estáticos para dentro de .next/standalone/.
# Sem esta cópia o servidor sobe e responde 200, mas serve a página sem CSS
# nem chunks de JS: uma falha que passa despercebida por qualquer teste que
# só verifique texto.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -f .next/standalone/server.js ]; then
  echo "erro: .next/standalone/server.js nao existe — rode 'npm run build' antes" >&2
  exit 1
fi

mkdir -p .next/standalone/.next
rm -rf .next/standalone/.next/static
cp -r .next/static .next/standalone/.next/static
if [ -d public ]; then
  rm -rf .next/standalone/public
  cp -r public .next/standalone/public
fi

exec node .next/standalone/server.js

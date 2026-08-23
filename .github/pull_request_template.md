## O quê

<!-- Uma ou duas frases. O "porquê" vai no corpo do commit, não aqui. -->

## Por quê

<!-- O problema que isto resolve. Se o PR contradiz algo em documents/, diga. -->

## Como verificar

<!-- Comandos e o resultado esperado, não "testei localmente". -->

```bash
```

## Antes de pedir merge

- [ ] Alvo correto: feature → `development`, ou `development` → `main`. Nada mais entra em `main`.
- [ ] Commits em Conventional Commits (o job `commits` reprova o resto).
- [ ] `npm run lint`, `npm run typecheck`, `npm test` e `npm run e2e` verdes localmente.
- [ ] Comportamento novo tem teste. Correção de bug tem o teste que falhava antes.
- [ ] Se mexeu em contrato de API, confere com `documents/backend/` — o documento vence a suposição.
- [ ] Se mudou stack ou estrutura de pastas, `CLAUDE.md` e `documents/MAIN_FRONTEND.md` acompanham.

<!--
documents/backend/ é cópia do repositório do backend e não se edita aqui.
Se algo lá parecer errado, avise no PR em vez de corrigir o arquivo.
-->

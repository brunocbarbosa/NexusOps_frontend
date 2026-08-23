# `features/` — organização por domínio

Cada subpasta é um domínio de negócio e **espelha um módulo do backend NestJS**:
`identity`, `helpdesk`, `auditing`. O racional completo está em
[`../../documents/MAIN_FRONTEND.md`](../../documents/MAIN_FRONTEND.md) §5.

## O que mora numa feature

Tudo que é específico daquele domínio, junto:

```
features/helpdesk/
  components/     # UI daquele domínio
  hooks/          # hooks específicos
  queries/        # queries e mutations do TanStack Query
  types.ts        # tipagens do domínio
```

## O que não mora aqui

`src/components/ui/` é do shadcn — primitivos sem conhecimento de domínio (botão, input,
dialog). Um componente que sabe o que é um chamado **não** pertence a lá, por mais reutilizável
que pareça.

O critério é conhecimento, não reuso: a timeline de auditoria de um chamado vive em
`features/auditing/`, mesmo aparecendo em várias telas.

## Por que esta pasta está quase vazia

Deliberado. `identity/`, `helpdesk/` e `auditing/` **não** foram criadas no scaffold: diretório
vazio não sobrevive ao git, e diretório especulativo convida a ser preenchido errado. A primeira
feature real cria a sua própria pasta.

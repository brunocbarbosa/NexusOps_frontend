"use client";

import { useQuery } from "@tanstack/react-query";

import type { UsersPage } from "@/features/identity/types";
import { fetchJson } from "@/lib/api/client";
import { MAX_PER_PAGE } from "@/lib/api/query";

import { helpdeskKeys } from "./keys";

/**
 * Quem pode receber um chamado.
 *
 * Só `ADMIN` e `AGENT` trabalham chamados — atribuir a um `REQUESTER` é 409
 * ("Only an AGENT or an ADMIN works tickets"), então oferecê-lo no seletor
 * seria oferecer uma escolha que sempre falha.
 *
 * São duas requisições porque `?role=` aceita um papel por vez. Elas vivem numa
 * chave de cache só: quem consome quer uma lista, não duas.
 *
 * **Teto de 100 por papel**, que é o teto do backend. Uma company com mais de
 * 100 agentes perde nomes da lista — lacuna conhecida, registrada na §4 da spec;
 * a saída é um combobox com busca no servidor, e não uma paginação aqui.
 *
 * Quem não pode listar usuários (um `REQUESTER`) recebe 403. O seletor de
 * responsável também não aparece para ele, então a query só é ligada onde faz
 * sentido — daí o `enabled`.
 */
export function useStaff(enabled: boolean) {
  return useQuery({
    queryKey: helpdeskKeys.staff,
    queryFn: async () => {
      const query = `perPage=${String(MAX_PER_PAGE)}&role=`;
      const [admins, agents] = await Promise.all([
        fetchJson<UsersPage>(`/api/users?${query}ADMIN`),
        fetchJson<UsersPage>(`/api/users?${query}AGENT`),
      ]);

      return [...admins.data, ...agents.data].sort((a, b) =>
        a.email.localeCompare(b.email),
      );
    },
    enabled,
    // O quadro de agentes muda em semanas, não em segundos, e este seletor é
    // aberto muitas vezes por sessão.
    staleTime: 5 * 60_000,
  });
}

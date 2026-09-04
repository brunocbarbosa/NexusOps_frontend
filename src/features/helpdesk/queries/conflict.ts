"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/errors";

import { parseVersionConflict } from "../api-messages";
import type { Ticket } from "../types";
import { helpdeskKeys } from "./keys";

/**
 * O 409 de concorrência otimista — a tela mais importante do produto.
 *
 * O que **não** se faz: repetir a requisição. A `version` continua velha e o
 * retry só produz outro 409. O que se faz é recarregar o chamado, mostrar o que
 * mudou contra o que se tentava salvar, e deixar reaplicar ou descartar.
 *
 * Reaplicar funciona porque a `version` de toda mutação vem do **cache**: com o
 * chamado recarregado, o mesmo `mutate` sai com a versão nova sem que ninguém
 * precise passá-la à mão.
 */

/** Uma linha do diálogo: o que o servidor tem agora × o que você tentou. */
export interface ConflictField {
  label: string;
  current: string;
  attempted: string;
}

export interface ConflictAttempt {
  /** Avaliado no render, contra o chamado já recarregado. */
  describe: (current: Ticket) => ConflictField[];
  /** Re-executa a mesma mutação. A versão nova vem do cache. */
  reapply: () => void;
}

export interface Conflict extends ConflictAttempt {
  /** A versão que a tela tinha quando tentou salvar. */
  from: number | null;
  /** A versão atual, lida da mensagem do backend. */
  to: number;
}

export type CaptureConflict = (error: unknown, attempt: ConflictAttempt) => void;

export function useVersionConflict(ticketId: string) {
  const queryClient = useQueryClient();
  const [conflict, setConflict] = useState<Conflict | null>(null);

  const capture = useCallback<CaptureConflict>(
    (error, attempt) => {
      if (!(error instanceof ApiError) || error.status !== 409) {
        return;
      }

      const to = parseVersionConflict(error.message);
      if (to === null) {
        // Outro 409 — transição ilegal, assignee inválido, chamado fechado.
        // Nenhum se resolve recarregando; quem os mostra é o alerta inline.
        return;
      }

      // Lido **antes** de invalidar: depois do refetch esta é a versão nova, e
      // o diálogo perderia o "de onde para onde".
      const from =
        queryClient.getQueryData<Ticket>(helpdeskKeys.ticket(ticketId))?.version ??
        null;

      void queryClient.invalidateQueries({
        queryKey: helpdeskKeys.ticket(ticketId),
      });

      setConflict({ ...attempt, from, to });
    },
    [queryClient, ticketId],
  );

  const dismiss = useCallback(() => {
    setConflict(null);
  }, []);

  return { conflict, capture, dismiss };
}

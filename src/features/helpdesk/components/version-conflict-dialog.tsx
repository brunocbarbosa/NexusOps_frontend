"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { Conflict } from "../queries/conflict";
import type { Ticket } from "../types";

/**
 * "Alguém alterou este chamado enquanto você editava."
 *
 * Mostra **os dois lados** de propósito. Só recarregar apagaria o que a pessoa
 * escreveu; só avisar do erro a deixaria adivinhando o que mudou. O diálogo é o
 * lugar onde a coluna `version` do backend vira uma decisão de quem está na
 * frente da tela.
 */
export function VersionConflictDialog({
  conflict,
  ticket,
  onDismiss,
}: {
  conflict: Conflict | null;
  /** Já recarregado: o `capture` invalidou a query antes de abrir o diálogo. */
  ticket: Ticket;
  onDismiss: () => void;
}) {
  const fields = conflict ? conflict.describe(ticket) : [];
  const changed = fields.filter((field) => field.current !== field.attempted);

  return (
    <Dialog
      open={conflict !== null}
      onOpenChange={(open) => {
        if (!open) {
          onDismiss();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Someone else changed this ticket</DialogTitle>
          <DialogDescription>
            {conflict?.from === null || conflict === null
              ? "It has moved on since you loaded it."
              : `You were on version ${String(conflict.from)}; it is now at version ${String(conflict.to)}.`}{" "}
            Nothing of yours was saved.
          </DialogDescription>
        </DialogHeader>

        {changed.length > 0 ? (
          <dl className="grid gap-3">
            {changed.map((field) => (
              <div key={field.label} className="grid gap-1">
                <dt className="text-sm font-medium">{field.label}</dt>
                <dd className="grid gap-1 text-sm sm:grid-cols-2">
                  <div className="rounded-md border px-2.5 py-1.5">
                    <span className="text-muted-foreground block text-xs">
                      Now on the server
                    </span>
                    <span className="whitespace-pre-wrap">{field.current}</span>
                  </div>
                  <div className="border-primary/40 bg-primary/5 rounded-md border px-2.5 py-1.5">
                    <span className="text-muted-foreground block text-xs">
                      What you tried to save
                    </span>
                    <span className="whitespace-pre-wrap">{field.attempted}</span>
                  </div>
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-muted-foreground text-sm">
            Your change matches what is there now, so there is nothing left to
            reapply.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onDismiss}>
            Keep theirs
          </Button>
          <Button
            onClick={() => {
              // Reaplicar sai com a versão nova sozinho: ela vem do cache, que
              // o `capture` já mandou recarregar. Repetir a requisição original
              // reapresentaria a versão velha e produziria outro 409.
              conflict?.reapply();
              onDismiss();
            }}
            disabled={changed.length === 0}
          >
            Reapply mine
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

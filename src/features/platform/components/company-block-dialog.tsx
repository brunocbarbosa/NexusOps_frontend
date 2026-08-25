"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ApiError } from "@/lib/api/errors";

import { useUpdateCompany } from "../queries/companies";
import type { Company } from "../types";

/**
 * Confirmação de bloquear e desbloquear uma company.
 *
 * A caixinha "Active" da tabela não muta sozinha: desmarcar tira todo mundo
 * daquela empresa de dentro do sistema, e isso merece uma frase antes. Mas é
 * reversível, e o texto diz isso — é o `DELETE` ao lado que não é.
 *
 * Como o diálogo de desativar usuário, ele **não fecha no erro**.
 */
export function CompanyBlockDialog({
  company,
  onClose,
}: {
  company: Company | null;
  onClose: () => void;
}) {
  const update = useUpdateCompany();
  const error = update.error instanceof ApiError ? update.error.message : null;

  // A ação é sempre o oposto do estado atual: a caixinha marcada bloqueia, a
  // desmarcada libera.
  const blocking = company?.isActive === true;

  return (
    <AlertDialog
      open={company !== null}
      onOpenChange={(open) => {
        if (!open) {
          update.reset();
          onClose();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {blocking ? "Block this company?" : "Unblock this company?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {blocking ? (
              <>
                No user of{" "}
                <span className="font-medium">{company?.name}</span> will be able
                to sign in, starting immediately. Nothing is deleted — no account,
                no ticket, no history — and you can undo this at any time.
              </>
            ) : (
              <>
                Users of <span className="font-medium">{company?.name}</span> will
                be able to sign in again, with the accounts and passwords they
                already had.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error ? (
          <p
            role="alert"
            className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
          >
            {error}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={update.isPending}
            onClick={(event) => {
              // Sem isto o Radix fecha no clique e o erro não teria onde
              // aparecer.
              event.preventDefault();
              if (company) {
                update.mutate(
                  { id: company.id, isActive: !company.isActive },
                  { onSuccess: onClose },
                );
              }
            }}
          >
            {blocking ? "Block" : "Unblock"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

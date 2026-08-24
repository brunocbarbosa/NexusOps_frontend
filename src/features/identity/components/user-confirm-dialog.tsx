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

import { useDeactivateUser, useRestoreUser } from "../queries/users";
import type { User } from "../types";

export type ConfirmAction = { type: "deactivate" | "restore"; user: User };

/**
 * Confirmação de desativar e de restaurar.
 *
 * O diálogo **não fecha no erro**, de propósito: os 409 deste fluxo — o último
 * ADMIN, desativar a si mesmo, já desativado — são estado, não digitação, e
 * fechar levaria a mensagem embora antes de ser lida.
 */
export function UserConfirmDialog({
  action,
  onClose,
}: {
  action: ConfirmAction | null;
  onClose: () => void;
}) {
  const deactivate = useDeactivateUser();
  const restore = useRestoreUser();

  const mutation = action?.type === "restore" ? restore : deactivate;
  const error = mutation.error instanceof ApiError ? mutation.error.message : null;

  function confirm() {
    if (!action) {
      return;
    }

    if (action.type === "restore") {
      restore.mutate(action.user.id, { onSuccess: onClose });
    } else {
      deactivate.mutate(action.user.id, { onSuccess: onClose });
    }
  }

  const restoring = action?.type === "restore";

  return (
    <AlertDialog
      open={action !== null}
      onOpenChange={(open) => {
        if (!open) {
          deactivate.reset();
          restore.reset();
          onClose();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {restoring ? "Restore this user?" : "Deactivate this user?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {restoring ? (
              <>
                <span className="font-medium">{action?.user.email}</span> gets the
                same account back, with its history attached.
              </>
            ) : (
              <>
                <span className="font-medium">{action?.user.email}</span> is signed
                out everywhere and can no longer sign in. Nothing is deleted — the
                account keeps its history and its email address stays taken, so you
                can restore it later.
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
            disabled={mutation.isPending}
            onClick={(event) => {
              // Sem isto o Radix fecha o diálogo no clique, e um 409 vindo do
              // backend não teria onde aparecer.
              event.preventDefault();
              confirm();
            }}
          >
            {restoring ? "Restore" : "Deactivate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

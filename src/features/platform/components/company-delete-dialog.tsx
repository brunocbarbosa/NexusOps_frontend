"use client";

import { useState } from "react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/errors";

import { useDeleteCompany } from "../queries/companies";
import type { Company } from "../types";

/**
 * Apagar uma company de verdade.
 *
 * Some com a empresa, seus usuários, seus chamados, seus comentários e sua
 * trilha de auditoria inteira, por cascade no banco. Não existe rota de
 * restauração e não existe undo.
 *
 * Por isso a confirmação exige **digitar o nome**: um clique distraído não
 * chega aqui, e o texto oferece bloquear, que faz o que quase todo mundo
 * queria fazer e é reversível.
 */
export function CompanyDeleteDialog({
  company,
  onClose,
  onBlockInstead,
}: {
  company: Company | null;
  onClose: () => void;
  onBlockInstead: (company: Company) => void;
}) {
  return (
    <AlertDialog
      open={company !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <AlertDialogContent>
        {/* `key` remonta o corpo a cada abertura: o campo digitado e o erro da
            tentativa anterior nascem zerados. */}
        {company ? (
          <DeleteBody
            key={company.id}
            company={company}
            onClose={onClose}
            onBlockInstead={onBlockInstead}
          />
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteBody({
  company,
  onClose,
  onBlockInstead,
}: {
  company: Company;
  onClose: () => void;
  onBlockInstead: (company: Company) => void;
}) {
  const [typed, setTyped] = useState("");
  const remove = useDeleteCompany();

  const error = remove.error instanceof ApiError ? remove.error.message : null;
  const confirmed = typed.trim() === company.name;

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle className="text-destructive">
          Delete {company.name} permanently?
        </AlertDialogTitle>
        <AlertDialogDescription>
          This deletes the company, every user in it, and every ticket, comment
          and audit record it ever had. There is no restore and no undo.
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div className="grid gap-2">
        <Label htmlFor="confirm-company-name">
          Type <span className="font-semibold">{company.name}</span> to confirm
        </Label>
        <Input
          id="confirm-company-name"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          placeholder={company.name}
        />
      </div>

      <p className="text-muted-foreground text-sm">
        Looking to stop them from signing in?{" "}
        <button
          type="button"
          className="text-foreground underline underline-offset-4"
          onClick={() => {
            onClose();
            onBlockInstead(company);
          }}
        >
          Block the company instead
        </button>{" "}
        — it does that, and it can be undone.
      </p>

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
          disabled={!confirmed || remove.isPending}
          className="bg-destructive text-white hover:bg-destructive/90"
          onClick={(event) => {
            event.preventDefault();
            remove.mutate(company.id, { onSuccess: onClose });
          }}
        >
          Delete permanently
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircleIcon, RotateCcwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api/errors";

import { parseDeactivatedUserId } from "../api-messages";
import { useCreateUser, useRestoreUser, useUpdateUser } from "../queries/users";
import { USER_ROLES, type User, type UserRole } from "../types";
import {
  PASSWORD_MAX_BYTES,
  passwordByteLength,
  validateEmail,
  validatePassword,
} from "../validation";

const ROLE_HINTS: Record<UserRole, string> = {
  ADMIN: "Manages every user in the company.",
  AGENT: "Works tickets and can list users.",
  REQUESTER: "Opens tickets. The safe default.",
};

export type UserFormMode = { type: "create" } | { type: "edit"; user: User };

/**
 * O formulário mora num componente separado e **com `key`**: reabrir o diálogo
 * o remonta, e com isso os campos e o erro da tentativa anterior nascem
 * zerados. Sincronizar isso num `useEffect` seria a mesma coisa, com um render
 * a mais e um caminho a mais para esquecer um campo.
 */
export function UserFormDialog({
  mode,
  onClose,
}: {
  mode: UserFormMode | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={mode !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        {mode ? (
          <UserForm
            key={mode.type === "edit" ? mode.user.id : "create"}
            mode={mode}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function UserForm({
  mode,
  onClose,
}: {
  mode: UserFormMode;
  onClose: () => void;
}) {
  const editing = mode.type === "edit" ? mode.user : null;

  const [email, setEmail] = useState(editing?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(editing?.role ?? "REQUESTER");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const create = useCreateUser();
  const update = useUpdateUser();
  const restore = useRestoreUser();
  const mutation = editing ? update : create;

  const conflictMessage =
    mutation.error instanceof ApiError && mutation.error.status === 409
      ? mutation.error.message
      : null;
  const deactivatedUserId = conflictMessage
    ? parseDeactivatedUserId(conflictMessage)
    : null;
  const otherError =
    mutation.error instanceof ApiError && !conflictMessage
      ? mutation.error.message
      : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const emailError = validateEmail(email);
    if (emailError) {
      setFieldError(emailError);
      return;
    }

    if (editing) {
      setFieldError(null);
      update.mutate(
        { id: editing.id, email: email.trim(), role },
        { onSuccess: onClose },
      );
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setFieldError(passwordError);
      return;
    }

    setFieldError(null);
    create.mutate({ email: email.trim(), password, role }, { onSuccess: onClose });
  }

  const bytes = passwordByteLength(password);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit user" : "New user"}</DialogTitle>
        <DialogDescription>
          {editing
            ? "Change the email address or the role. Passwords can only be changed by their owner."
            : "The user signs in with your company domain and this email."}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} noValidate className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="user-email">Email</Label>
          <Input
            id="user-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="agent@acme.com"
            autoComplete="off"
          />
        </div>

        {editing ? null : (
          <div className="grid gap-2">
            <Label htmlFor="user-password">Temporary password</Label>
            <Input
              id="user-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
            />
            <p className="text-muted-foreground text-xs">
              {/* Bytes, não caracteres: o bcrypt trunca no byte 72 sem avisar. */}
              {bytes > 0
                ? `${bytes} of ${PASSWORD_MAX_BYTES} bytes used.`
                : `At least 8 characters, up to ${PASSWORD_MAX_BYTES} bytes.`}
            </p>
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor="user-role">Role</Label>
          <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
            <SelectTrigger id="user-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {USER_ROLES.map((option) => (
                <SelectItem key={option} value={option}>
                  {option.charAt(0) + option.slice(1).toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">{ROLE_HINTS[role]}</p>
        </div>

        {fieldError ? (
          <p role="alert" className="text-destructive text-sm">
            {fieldError}
          </p>
        ) : null}

        {conflictMessage ? (
          <div
            role="alert"
            className="border-destructive/30 bg-destructive/10 grid gap-2 rounded-md border px-3 py-2 text-sm"
          >
            <p className="text-destructive">{conflictMessage}</p>
            {deactivatedUserId ? (
              // O endereço continua ocupado pelo usuário desativado, então
              // criar um substituto é impossível: restaurar é a saída, e o
              // backend mandou o id justamente para que ela exista aqui.
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={restore.isPending}
                onClick={() => {
                  restore.mutate(deactivatedUserId, { onSuccess: onClose });
                }}
              >
                <RotateCcwIcon aria-hidden />
                Restore this user
              </Button>
            ) : null}
          </div>
        ) : null}

        {otherError ? (
          <p role="alert" className="text-destructive text-sm">
            {otherError}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <>
                <LoaderCircleIcon className="animate-spin" aria-hidden />
                Saving…
              </>
            ) : editing ? (
              "Save changes"
            ) : (
              "Create user"
            )}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

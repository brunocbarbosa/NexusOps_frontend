"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/errors";

import { useChangePassword } from "../queries/session";
import {
  PASSWORD_MAX_BYTES,
  passwordByteLength,
  validatePassword,
  validateRequired,
} from "../validation";

export function ChangePasswordForm() {
  const changePassword = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // A senha atual não passa pela política nova: ela pode ser anterior a uma
    // mudança de política, e recusá-la trancaria a pessoa fora justamente da
    // rota que conserta isso.
    const currentError = validateRequired(currentPassword, "Current password");
    if (currentError) {
      setFieldError(currentError);
      return;
    }

    const newError = validatePassword(newPassword);
    if (newError) {
      setFieldError(newError);
      return;
    }

    if (newPassword !== confirmation) {
      setFieldError("The two new passwords do not match.");
      return;
    }

    setFieldError(null);
    changePassword.mutate({ currentPassword, newPassword });
  }

  const serverError =
    changePassword.error instanceof ApiError ? changePassword.error.message : null;
  const bytes = passwordByteLength(newPassword);

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="current-password">Current password</Label>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          {bytes > 0
            ? `${bytes} of ${PASSWORD_MAX_BYTES} bytes used.`
            : `At least 8 characters, up to ${PASSWORD_MAX_BYTES} bytes.`}
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </div>

      {fieldError ?? serverError ? (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {fieldError ?? serverError}
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={changePassword.isPending}>
          {changePassword.isPending ? (
            <>
              <LoaderCircleIcon className="animate-spin" aria-hidden />
              Changing…
            </>
          ) : (
            "Change password"
          )}
        </Button>
      </div>
    </form>
  );
}

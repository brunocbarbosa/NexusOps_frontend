import type { Metadata } from "next";

import { ChangePasswordForm } from "@/features/identity/components/change-password-form";

export const metadata: Metadata = {
  title: "Account · NexusOps",
};

export default function AccountPage() {
  return (
    <div className="grid max-w-xl gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-muted-foreground text-sm">
          Your password is the only thing you can change here — and only you can
          change it. Administrators cannot set it for you.
        </p>
      </header>

      <div className="bg-card rounded-xl border p-6">
        <ChangePasswordForm />
      </div>

      <p className="text-muted-foreground text-sm">
        Changing your password signs out every session, including this one. You
        will be asked to sign in again with the new password.
      </p>
    </div>
  );
}

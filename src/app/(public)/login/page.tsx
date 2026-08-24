import type { Metadata } from "next";

import { BrandMark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoginForm } from "@/features/identity/components/login-form";
import { safeNextPath } from "@/features/identity/next-path";

export const metadata: Metadata = {
  title: "Sign in · NexusOps",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(first(params.next));
  const passwordChanged = first(params.reason) === "password-changed";

  return (
    <main className="bg-muted/40 relative flex min-h-screen items-center justify-center p-6">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl">
            <BrandMark className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">NexusOps</h1>
            <p className="text-muted-foreground text-sm">
              Internal helpdesk, assets and audit trail.
            </p>
          </div>
        </div>

        <div className="bg-card rounded-xl border p-6 shadow-sm">
          {passwordChanged ? (
            <p className="bg-muted text-muted-foreground mb-5 rounded-md px-3 py-2 text-sm">
              Your password was changed and every session was signed out. Sign in
              again with the new password.
            </p>
          ) : null}

          <LoginForm next={next} />
        </div>

        <p className="text-muted-foreground mt-6 text-center text-xs">
          Ask an administrator of your company for access.
        </p>
      </div>
    </main>
  );
}

function first(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeOffIcon, LoaderCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/errors";

import { useLogin } from "../queries/session";
import { validateEmail, validateRequired, validateTenantDomain } from "../validation";

type FieldName = "tenantDomain" | "email" | "password";
type FieldErrors = Partial<Record<FieldName, string>>;

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const login = useLogin();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const credentials = {
      tenantDomain: readField(form, "tenantDomain").trim(),
      email: readField(form, "email").trim(),
      password: readField(form, "password"),
    };

    const found: FieldErrors = {};
    const domain = validateTenantDomain(credentials.tenantDomain);
    if (domain) found.tenantDomain = domain;
    const email = validateEmail(credentials.email);
    if (email) found.email = email;
    // Só presença: aplicar a política de senha aqui responderia "esta conta usa
    // uma senha curta?" antes de qualquer credencial ser checada.
    const password = validateRequired(credentials.password, "Password");
    if (password) found.password = password;

    setErrors(found);
    if (Object.keys(found).length > 0) {
      return;
    }

    login.mutate(credentials, {
      onSuccess: () => {
        router.replace(next);
      },
    });
  }

  const formError = login.error
    ? login.error instanceof ApiError
      ? login.error.message
      : "Something went wrong. Try again."
    : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5">
      {formError ? (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {formError}
        </p>
      ) : null}

      <Field
        name="tenantDomain"
        label="Company domain"
        placeholder="acme.com"
        autoComplete="organization"
        error={errors.tenantDomain}
        hint="The domain your company signed up with."
      />

      <Field
        name="email"
        label="Email"
        type="email"
        placeholder="you@acme.com"
        autoComplete="username"
        error={errors.email}
      />

      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex items-center px-3"
          >
            {showPassword ? (
              <EyeOffIcon className="size-4" aria-hidden />
            ) : (
              <EyeIcon className="size-4" aria-hidden />
            )}
          </button>
        </div>
        {errors.password ? (
          <p id="password-error" className="text-destructive text-sm">
            {errors.password}
          </p>
        ) : null}
      </div>

      <Button type="submit" className="mt-1 w-full" disabled={login.isPending}>
        {login.isPending ? (
          <>
            <LoaderCircleIcon className="animate-spin" aria-hidden />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}

/** `FormData.get` devolve `string | File | null`; estes campos são sempre texto. */
function readField(form: FormData, name: FieldName): string {
  const value = form.get(name);

  return typeof value === "string" ? value : "";
}

interface FieldProps {
  name: FieldName;
  label: string;
  error?: string;
  hint?: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}

function Field({ name, label, error, hint, ...input }: FieldProps) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;

  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        {...input}
      />
      {error ? (
        <p id={errorId} className="text-destructive text-sm">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-muted-foreground text-sm">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

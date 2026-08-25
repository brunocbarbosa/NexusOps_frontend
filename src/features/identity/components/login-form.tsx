"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeOffIcon, LoaderCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/errors";

import { landingPath } from "../next-path";
import { useLogin } from "../queries/session";
import { validateEmail, validateRequired, validateTenantDomain } from "../validation";

type FieldName = "tenantDomain" | "email" | "password";
type FieldErrors = Partial<Record<FieldName, string>>;

/**
 * O domínio reservado do operador da plataforma. Não é uma empresa, e nenhuma
 * pode reivindicá-lo — `POST /platform/companies` recusa com 400.
 */
const PLATFORM_DOMAIN = "platform";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const login = useLogin();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);

  /**
   * Marcar entra como operador da plataforma.
   *
   * O backend não tem rota de login separada: é o mesmo `POST /auth/login` com
   * `tenantDomain: "platform"`. A caixinha existe para ninguém precisar decorar
   * essa palavra, e para deixar claro que ali não vai o domínio de empresa
   * nenhuma — por isso ela **trava** o campo em vez de só preenchê-lo.
   */
  const [asOperator, setAsOperator] = useState(false);
  const [domain, setDomain] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const credentials = {
      // Campo desabilitado não entra no `FormData`, então o domínio reservado é
      // informado aqui em vez de lido do formulário.
      tenantDomain: asOperator ? PLATFORM_DOMAIN : domain.trim(),
      email: readField(form, "email").trim(),
      password: readField(form, "password"),
    };

    const found: FieldErrors = {};
    // Como operador não há o que validar: o valor é constante e não veio de
    // quem está digitando.
    const domainError = asOperator
      ? null
      : validateTenantDomain(credentials.tenantDomain);
    if (domainError) found.tenantDomain = domainError;
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
      onSuccess: ({ user }) => {
        // O papel vem no corpo do login, e é a única forma de saber o console
        // certo aqui: o porteiro de rotas só enxerga a presença do cookie, e a
        // UI nunca decodifica o JWT.
        router.replace(landingPath(user.role, next));
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

      <div className="grid gap-2">
        <Field
          name="tenantDomain"
          label="Company domain"
          placeholder="acme.com"
          autoComplete="organization"
          error={errors.tenantDomain}
          hint={
            asOperator
              ? "Locked: the platform operator does not belong to a company."
              : "The domain your company signed up with."
          }
          value={asOperator ? PLATFORM_DOMAIN : domain}
          onChange={(event) => setDomain(event.target.value)}
          disabled={asOperator}
        />

        <div className="flex items-center gap-2">
          <Checkbox
            id="as-operator"
            checked={asOperator}
            onCheckedChange={(checked) => {
              setAsOperator(checked === true);
              // O erro do campo travado não faria sentido continuar na tela.
              setErrors((current) => ({ ...current, tenantDomain: undefined }));
            }}
          />
          <Label htmlFor="as-operator" className="text-muted-foreground text-sm">
            Sign in as platform operator
          </Label>
        </div>
      </div>

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
  value?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
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

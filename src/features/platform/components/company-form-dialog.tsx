"use client";

import { useState, type FormEvent } from "react";
import { CheckIcon, LoaderCircleIcon, TriangleAlertIcon } from "lucide-react";

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
import { Separator } from "@/components/ui/separator";
import { ApiError } from "@/lib/api/errors";

import {
  PASSWORD_MAX_BYTES,
  passwordByteLength,
  validateEmail,
  validatePassword,
  validateRequired,
  validateTenantDomain,
} from "../../identity/validation";
import { useCreateCompany, useUpdateCompany } from "../queries/companies";
import type { Company, CreateCompanyResult } from "../types";

export type CompanyFormMode =
  | { type: "create" }
  | { type: "edit"; company: Company };

export function CompanyFormDialog({
  mode,
  onClose,
}: {
  mode: CompanyFormMode | null;
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
      <DialogContent className="sm:max-w-lg">
        {/* Remontado por `key`, como o de usuários: reabrir zera campos e erro. */}
        {mode ? (
          <CompanyForm
            key={mode.type === "edit" ? mode.company.id : "create"}
            mode={mode}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CompanyForm({
  mode,
  onClose,
}: {
  mode: CompanyFormMode;
  onClose: () => void;
}) {
  const editing = mode.type === "edit" ? mode.company : null;

  const [name, setName] = useState(editing?.name ?? "");
  const [domain, setDomain] = useState(editing?.domain ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const create = useCreateCompany();
  const update = useUpdateCompany();
  const mutation = editing ? update : create;

  // O 201 é a **única** vez que estas credenciais existem em algum lugar: não
  // há email de convite e não há reset de senha. Enquanto isto estiver
  // preenchido, o diálogo mostra o painel e só fecha por botão.
  const [created, setCreated] = useState<CreateCompanyResult | null>(null);

  const apiError = mutation.error instanceof ApiError ? mutation.error.message : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nameError = validateRequired(name, "Company name");
    if (nameError) {
      setFieldError(nameError);
      return;
    }

    const domainError = validateTenantDomain(domain);
    if (domainError) {
      setFieldError(domainError);
      return;
    }

    if (editing) {
      setFieldError(null);
      update.mutate(
        { id: editing.id, name: name.trim(), domain: domain.trim() },
        { onSuccess: onClose },
      );
      return;
    }

    const emailError = validateEmail(email);
    if (emailError) {
      setFieldError(emailError);
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setFieldError(passwordError);
      return;
    }

    setFieldError(null);
    create.mutate(
      {
        name: name.trim(),
        domain: domain.trim(),
        admin: { email: email.trim(), password },
      },
      { onSuccess: setCreated },
    );
  }

  if (created) {
    return <CreatedPanel result={created} password={password} onClose={onClose} />;
  }

  const bytes = passwordByteLength(password);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit company" : "New company"}</DialogTitle>
        <DialogDescription>
          {editing
            ? "Change the name or the domain. Blocking is done from the Active checkbox in the list."
            : "A company and its first administrator are created together — a company nobody can administer is one nobody can enter."}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} noValidate className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="company-name">Company name</Label>
          <Input
            id="company-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Acme Industries"
            autoComplete="off"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="company-domain">Domain</Label>
          <Input
            id="company-domain"
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            placeholder="acme.example"
            autoComplete="off"
          />
          <p className="text-muted-foreground text-xs">
            What its people type in the &ldquo;Company domain&rdquo; field when
            they sign in.
          </p>
        </div>

        {editing ? null : (
          <>
            <Separator />

            <div className="grid gap-1">
              <h3 className="text-sm font-medium">First administrator</h3>
              <p className="text-muted-foreground text-xs">
                They will manage the company&apos;s users. You will see these
                credentials once.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="company-admin-email">Email</Label>
              <Input
                id="company-admin-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@acme.example"
                autoComplete="off"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="company-admin-password">Password</Label>
              <Input
                id="company-admin-password"
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
          </>
        )}

        {fieldError ? (
          <p role="alert" className="text-destructive text-sm">
            {fieldError}
          </p>
        ) : null}

        {apiError ? (
          <p
            role="alert"
            className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
          >
            {apiError}
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
              "Create company"
            )}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

/**
 * O que aparece depois do 201.
 *
 * Não fecha sozinho, e é o único diálogo do projeto que não fecha: a senha
 * digitada não é recuperável em lugar nenhum depois daqui — o backend guarda só
 * o hash, não há email de convite e não há "esqueci minha senha". Fechar no
 * sucesso, como os outros fazem, perderia a credencial.
 */
function CreatedPanel({
  result,
  password,
  onClose,
}: {
  result: CreateCompanyResult;
  password: string;
  onClose: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CheckIcon className="size-5 text-emerald-600" aria-hidden />
          {result.company.name} is ready
        </DialogTitle>
        <DialogDescription>
          Hand these credentials to the administrator. They sign in at the same
          page you do.
        </DialogDescription>
      </DialogHeader>

      <dl className="grid gap-3 rounded-lg border p-4 text-sm">
        <div className="grid gap-0.5">
          <dt className="text-muted-foreground text-xs">Company domain</dt>
          <dd className="font-mono">{result.company.domain}</dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="text-muted-foreground text-xs">Email</dt>
          <dd className="font-mono">{result.admin.email}</dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="text-muted-foreground text-xs">Password</dt>
          <dd className="font-mono break-all">{password}</dd>
        </div>
      </dl>

      <p
        role="alert"
        className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
      >
        <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          This password is not stored anywhere you can read it again, and there is
          no password reset. Copy it before closing.
        </span>
      </p>

      <DialogFooter>
        <Button type="button" onClick={onClose}>
          I&apos;ve saved these credentials
        </Button>
      </DialogFooter>
    </>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircleIcon } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/errors";

import { categoryLabel, priorityLabel } from "../format";
import { useCreateTicket } from "../queries/tickets";
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  type TicketCategory,
  type TicketPriority,
} from "../types";

/** O backend recusa título com menos de 3 caracteres com um 400 de validação. */
const TITLE_MIN = 3;
const TITLE_MAX = 255;

/**
 * O formulário mora num componente com `key`, como o de usuários: reabrir o
 * diálogo o remonta, e os campos e o erro da tentativa anterior nascem zerados.
 */
export function NewTicketDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {open ? <NewTicketForm onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function NewTicketForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const create = useCreateTicket();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("MEDIUM");
  const [category, setCategory] = useState<TicketCategory>("OTHER");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const error = create.error instanceof ApiError ? create.error.message : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = title.trim();
    if (trimmed.length < TITLE_MIN) {
      setFieldError(`Give it at least ${String(TITLE_MIN)} characters.`);
      return;
    }

    setFieldError(null);
    create.mutate(
      {
        title: trimmed,
        ...(description.trim() ? { description: description.trim() } : {}),
        priority,
        category,
      },
      {
        // Abrir um chamado e continuar na lista esconderia o que acabou de ser
        // criado atrás de qualquer filtro ativo. Vai direto para ele.
        onSuccess: (ticket) => {
          onClose();
          router.push(`/tickets/${ticket.id}`);
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>New ticket</DialogTitle>
        <DialogDescription>
          It is opened in your name — there is no way to open one on someone
          else&apos;s behalf.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor="ticket-title">Title</Label>
        <Input
          id="ticket-title"
          value={title}
          maxLength={TITLE_MAX}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
          aria-invalid={fieldError !== null}
          aria-describedby={fieldError ? "ticket-title-error" : undefined}
          placeholder="Printer on the 3rd floor is jammed"
          autoFocus
        />
        {fieldError ? (
          <p id="ticket-title-error" role="alert" className="text-destructive text-sm">
            {fieldError}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="ticket-description">Description</Label>
        <Textarea
          id="ticket-description"
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
          }}
          placeholder="What happens, and what you already tried."
          rows={4}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="ticket-priority">Priority</Label>
          <Select
            value={priority}
            onValueChange={(value) => {
              setPriority(value as TicketPriority);
            }}
          >
            <SelectTrigger id="ticket-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TICKET_PRIORITIES.map((option) => (
                <SelectItem key={option} value={option}>
                  {priorityLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="ticket-category">Category</Label>
          <Select
            value={category}
            onValueChange={(value) => {
              setCategory(value as TicketCategory);
            }}
          >
            <SelectTrigger id="ticket-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TICKET_CATEGORIES.map((option) => (
                <SelectItem key={option} value={option}>
                  {categoryLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {error}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? (
            <LoaderCircleIcon className="animate-spin" aria-hidden />
          ) : null}
          Open ticket
        </Button>
      </DialogFooter>
    </form>
  );
}

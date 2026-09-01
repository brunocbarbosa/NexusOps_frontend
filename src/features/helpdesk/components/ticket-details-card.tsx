"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { useUpdateTicket } from "../queries/tickets";
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  type Ticket,
  type TicketCategory,
  type TicketPriority,
} from "../types";

/**
 * Título, descrição, prioridade e categoria — o que `PATCH /tickets/:id` aceita.
 *
 * Status e responsável **não** estão aqui: têm rotas próprias, que exigem ADMIN
 * ou AGENT. Juntá-los num formulário só daria a impressão de que salvar move o
 * chamado, e um requester veria controles que a API recusa.
 *
 * Um chamado `CLOSED` recusa este PATCH. O formulário vira leitura em vez de
 * oferecer um botão que sempre falha.
 */
export function TicketDetailsCard({ ticket }: { ticket: Ticket }) {
  const [editing, setEditing] = useState(false);

  if (ticket.status === "CLOSED" || !editing) {
    return (
      <section className="grid gap-3 rounded-lg border p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-medium">Details</h2>
          {ticket.status === "CLOSED" ? null : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditing(true);
              }}
            >
              Edit
            </Button>
          )}
        </div>
        <p className="text-sm whitespace-pre-wrap">
          {ticket.description ?? (
            <span className="text-muted-foreground">No description.</span>
          )}
        </p>
      </section>
    );
  }

  return (
    <TicketDetailsForm
      // Remontar ao reabrir zera os campos e o erro da tentativa anterior, em
      // vez de sincronizar num efeito.
      key={ticket.version}
      ticket={ticket}
      onDone={() => {
        setEditing(false);
      }}
    />
  );
}

function TicketDetailsForm({
  ticket,
  onDone,
}: {
  ticket: Ticket;
  onDone: () => void;
}) {
  const update = useUpdateTicket(ticket.id);

  const [title, setTitle] = useState(ticket.title);
  const [description, setDescription] = useState(ticket.description ?? "");
  const [priority, setPriority] = useState<TicketPriority>(ticket.priority);
  const [category, setCategory] = useState<TicketCategory>(ticket.category);

  const error = update.error instanceof ApiError ? update.error.message : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    update.mutate(
      // A `version` não vem daqui: o hook a lê do cache. Um campo de formulário
      // envelheceria em silêncio depois de um conflito resolvido.
      { title: title.trim(), description, priority, category },
      { onSuccess: onDone },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-lg border p-4">
      <h2 className="text-sm font-medium">Details</h2>

      <div className="grid gap-2">
        <Label htmlFor="edit-title">Title</Label>
        <Input
          id="edit-title"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="edit-description">Description</Label>
        <Textarea
          id="edit-description"
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
          }}
          rows={4}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="edit-priority">Priority</Label>
          <Select
            value={priority}
            onValueChange={(value) => {
              setPriority(value as TicketPriority);
            }}
          >
            <SelectTrigger id="edit-priority">
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
          <Label htmlFor="edit-category">Category</Label>
          <Select
            value={category}
            onValueChange={(value) => {
              setCategory(value as TicketCategory);
            }}
          >
            <SelectTrigger id="edit-category">
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

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? (
            <LoaderCircleIcon className="animate-spin" aria-hidden />
          ) : null}
          Save
        </Button>
      </div>
    </form>
  );
}

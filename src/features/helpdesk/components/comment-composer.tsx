"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/errors";

import { useAddComment } from "../queries/tickets";
import type { Ticket } from "../types";

/**
 * Escrever na thread.
 *
 * **Um chamado fechado recusa comentário novo** — 409 —, mas continua legível:
 * frozen, não hidden. O compositor some com uma explicação em vez de deixar o
 * botão levar a um erro.
 *
 * A nota interna é o comentário que o cliente não deve ler, e só ADMIN ou AGENT
 * pode escrevê-la. O switch não aparece para um `REQUESTER`: ele receberia 403,
 * e um controle que sempre falha é pior que controle nenhum.
 */
export function CommentComposer({
  ticket,
  canWriteInternal,
}: {
  ticket: Ticket;
  canWriteInternal: boolean;
}) {
  const [body, setBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const addComment = useAddComment(ticket.id);

  if (ticket.status === "CLOSED") {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-4 text-sm">
        This ticket is closed and takes no new comments. The thread above stays
        readable.
      </p>
    );
  }

  const error = addComment.error instanceof ApiError ? addComment.error.message : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = body.trim();
    if (!trimmed) {
      return;
    }

    addComment.mutate(
      // `isInternal` só sai daqui como booleano de verdade — e só quando é
      // verdadeiro, para não mandar um campo que a maioria dos comentários não
      // usa.
      { body: trimmed, ...(isInternal ? { isInternal: true } : {}) },
      {
        onSuccess: () => {
          setBody("");
          setIsInternal(false);
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor="comment-body">Add a comment</Label>
        <Textarea
          id="comment-body"
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
          }}
          placeholder="What changed, what you tried, what you need."
          rows={3}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {canWriteInternal ? (
          <div className="flex items-center gap-2">
            <Switch
              id="internal-note"
              checked={isInternal}
              onCheckedChange={setIsInternal}
            />
            <Label htmlFor="internal-note" className="text-muted-foreground text-sm">
              Internal note — the requester never sees it
            </Label>
          </div>
        ) : (
          <span />
        )}

        <Button type="submit" disabled={addComment.isPending || !body.trim()}>
          {addComment.isPending ? (
            <LoaderCircleIcon className="animate-spin" aria-hidden />
          ) : null}
          {isInternal ? "Add note" : "Comment"}
        </Button>
      </div>

      {error ? (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}

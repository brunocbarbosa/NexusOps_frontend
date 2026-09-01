"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { categoryLabel, priorityLabel, statusLabel } from "../format";
import type { TicketCategory, TicketPriority, TicketStatus } from "../types";

/**
 * Status e prioridade são coisas diferentes e não podem parecer a mesma: o
 * status é onde o chamado está, a prioridade é o quanto ele urge. Por isso o
 * status é sólido e a prioridade é contornada — quem passa os olhos na lista
 * distingue as duas colunas sem ler.
 */
const STATUS_CLASSES: Record<TicketStatus, string> = {
  OPEN: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  IN_PROGRESS: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  RESOLVED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  CLOSED: "bg-muted text-muted-foreground",
};

const PRIORITY_CLASSES: Record<TicketPriority, string> = {
  LOW: "text-muted-foreground",
  MEDIUM: "text-foreground",
  HIGH: "text-orange-700 dark:text-orange-300 border-orange-500/40",
  URGENT: "text-red-700 dark:text-red-300 border-red-500/50",
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent", STATUS_CLASSES[status])}
    >
      {statusLabel(status)}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <Badge variant="outline" className={PRIORITY_CLASSES[priority]}>
      {priorityLabel(priority)}
    </Badge>
  );
}

export function CategoryBadge({ category }: { category: TicketCategory }) {
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {categoryLabel(category)}
    </Badge>
  );
}

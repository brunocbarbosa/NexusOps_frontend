import { Badge } from "@/components/ui/badge";

import type { UserRole } from "../types";

/**
 * Os três papéis são hierárquicos só por convenção — o backend checa
 * pertencimento a uma lista, nunca ordem. As cores aqui sinalizam alcance, não
 * ranking.
 */
const LABELS: Record<UserRole, string> = {
  ADMIN: "Admin",
  AGENT: "Agent",
  REQUESTER: "Requester",
};

const VARIANTS: Record<UserRole, string> = {
  ADMIN: "border-transparent bg-primary/10 text-primary",
  AGENT: "border-transparent bg-sky-500/10 text-sky-700 dark:text-sky-300",
  REQUESTER: "text-muted-foreground",
};

export function RoleBadge({ role }: { role: UserRole }) {
  return (
    <Badge variant="outline" className={VARIANTS[role]}>
      {LABELS[role]}
    </Badge>
  );
}

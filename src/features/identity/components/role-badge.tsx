import { Badge } from "@/components/ui/badge";

import type { Role } from "../types";

/**
 * Os papéis **não** são hierárquicos: o backend checa pertinência numa lista,
 * nunca ordem, então "mais alto" nunca implica acesso. As cores sinalizam
 * alcance, não ranking.
 *
 * `ADMIN_MASTER` fica de fora do azul/roxo dos outros de propósito: ele não é
 * um ADMIN com mais poder, é alguém de fora de toda company.
 */
const LABELS: Record<Role, string> = {
  ADMIN_MASTER: "Platform operator",
  ADMIN: "Admin",
  AGENT: "Agent",
  REQUESTER: "Requester",
};

const VARIANTS: Record<Role, string> = {
  ADMIN_MASTER:
    "border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-300",
  ADMIN: "border-transparent bg-primary/10 text-primary",
  AGENT: "border-transparent bg-sky-500/10 text-sky-700 dark:text-sky-300",
  REQUESTER: "text-muted-foreground",
};

export function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge variant="outline" className={VARIANTS[role]}>
      {LABELS[role]}
    </Badge>
  );
}

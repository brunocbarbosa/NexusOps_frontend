import type { Metadata } from "next";

import { TicketPage } from "@/features/helpdesk/components/ticket-page";

export const metadata: Metadata = {
  title: "Ticket · NexusOps",
};

/**
 * O id vem dos params e desce como prop. Nenhum dado autenticado é buscado
 * aqui: um Server Component que renovasse a sessão gastaria o refresh token sem
 * conseguir persistir o par rotacionado, e reapresentar o antigo revoga a
 * família inteira.
 */
export default async function Page({ params }: PageProps<"/tickets/[id]">) {
  const { id } = await params;

  return <TicketPage ticketId={id} />;
}

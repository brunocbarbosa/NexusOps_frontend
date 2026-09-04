import type { Metadata } from "next";

import { TicketsPage } from "@/features/helpdesk/components/tickets-page";

export const metadata: Metadata = {
  title: "Tickets · NexusOps",
};

export default function Page() {
  return <TicketsPage />;
}

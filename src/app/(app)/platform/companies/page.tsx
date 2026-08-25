import type { Metadata } from "next";

import { CompaniesPage } from "@/features/platform/components/companies-page";

export const metadata: Metadata = {
  title: "Companies · NexusOps",
};

export default function Page() {
  return <CompaniesPage />;
}

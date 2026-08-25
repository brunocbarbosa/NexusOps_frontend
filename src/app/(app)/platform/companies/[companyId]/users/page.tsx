import type { Metadata } from "next";

import { CompanyUsersPage } from "@/features/platform/components/company-users-page";

export const metadata: Metadata = {
  title: "Company users · NexusOps",
};

export default async function Page({
  params,
}: PageProps<"/platform/companies/[companyId]/users">) {
  // O Server Component só lê o parâmetro da rota. Buscar a company aqui seria
  // dado autenticado num RSC: ele gastaria o refresh token sem conseguir
  // persistir o par rotacionado, e o token velho reapresentado revoga a
  // família inteira.
  const { companyId } = await params;

  return <CompanyUsersPage companyId={companyId} />;
}

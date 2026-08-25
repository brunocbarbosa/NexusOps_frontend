import type { Metadata } from "next";

import { UsersPage } from "@/features/identity/components/users-page";

export const metadata: Metadata = {
  title: "Users · NexusOps",
};

export default function Page() {
  return <UsersPage />;
}

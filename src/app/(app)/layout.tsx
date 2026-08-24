import { AppShell } from "@/features/identity/components/app-shell";

/**
 * Casca da aplicação autenticada.
 *
 * Quem barra o acesso é o `proxy.ts`, antes de renderizar. Este layout só
 * desenha — e o que sabe sobre a sessão vem de `/api/auth/me`, no cliente,
 * porque um Server Component não conseguiria gravar os cookies de uma
 * renovação.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}

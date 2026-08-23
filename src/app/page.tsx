import { Button } from "@/components/ui/button";

/**
 * Página de verificação do scaffold.
 *
 * Existe para provar que a cadeia Tailwind -> shadcn -> componente renderiza.
 * A primeira tela real de produto substitui este arquivo inteiro.
 */
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">NexusOps</h1>
      <p className="text-muted-foreground text-sm">
        Scaffold operante — Tailwind e shadcn/ui renderizando.
      </p>
      <Button>Componente shadcn</Button>
    </main>
  );
}

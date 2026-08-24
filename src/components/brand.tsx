import { cn } from "@/lib/utils";

/**
 * A marca: um nó dentro de um hexágono. Formas simples de propósito — a versão
 * anterior, com três nós ligados ao centro, virava um borrão nos 20 px em que
 * ela aparece de verdade.
 *
 * SVG inline em vez de arquivo em `public/`: assim herda a cor do texto e
 * acompanha o tema sem precisar de duas versões.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn("size-5", className)}
    >
      <path
        d="M12 3.6 19.3 7.8v8.4L12 20.4 4.7 16.2V7.8z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" />
    </svg>
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
        <BrandMark />
      </span>
      NexusOps
    </span>
  );
}

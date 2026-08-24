import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { ThemeScript } from "@/components/theme-script";
import { Providers } from "./providers";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "NexusOps",
  description: "Internal helpdesk, asset tracking and audit trail.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // A interface do produto é em inglês; a documentação do repositório é em
  // português. `lang` descreve o que está na tela.
  return (
    <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

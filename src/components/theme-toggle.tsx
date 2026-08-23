"use client";

import { MoonIcon, SunIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * O tema vive na classe `dark` do `<html>` e no localStorage — o mesmo par que
 * o `ThemeScript` lê antes da primeira pintura.
 *
 * Sem estado de React de propósito: qual ícone aparece é decisão do CSS, pela
 * própria variante `dark`. Guardar o tema em `useState` obrigaria a lê-lo do
 * DOM depois de montar, e o servidor renderizaria o ícone errado até lá.
 */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const dark = !root.classList.contains("dark");

    root.classList.toggle("dark", dark);
    localStorage.setItem("nexusops-theme", dark ? "dark" : "light");
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
      <SunIcon className="hidden dark:block" aria-hidden />
      <MoonIcon className="dark:hidden" aria-hidden />
    </Button>
  );
}

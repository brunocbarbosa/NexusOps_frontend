import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Requisito de documents/MAIN_FRONTEND.md: a imagem Docker depende do output
  // standalone, que empacota apenas o necessário para rodar em produção.
  output: "standalone",

  // O TanStack Table 9 é publicado só em ESM (`"type": "module"`). O `next/jest`
  // não transforma nada em node_modules a menos que o pacote esteja aqui — sem
  // esta linha, qualquer teste que renderize a grid falha com
  // `SyntaxError: Cannot use import statement outside a module`.
  transpilePackages: ["@tanstack/react-table", "@tanstack/table-core"],
};

export default nextConfig;

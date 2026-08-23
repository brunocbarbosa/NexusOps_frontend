import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Requisito de documents/MAIN_FRONTEND.md: a imagem Docker depende do output
  // standalone, que empacota apenas o necessário para rodar em produção.
  output: "standalone",
};

export default nextConfig;

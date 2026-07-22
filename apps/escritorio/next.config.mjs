import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
// output: 'standalone' gera um bundle mínimo p/ a imagem Docker (Portainer Swarm).
// outputFileTracingRoot fixa a raiz neste app (evita confundir com o lockfile do PDV).
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: __dirname,
  // Transpila os pacotes do workspace (ADR-0019/0020): TS/TSX + WASM.
  transpilePackages: ["@livraria/ui", "@livraria/domain"],
};

export default nextConfig;

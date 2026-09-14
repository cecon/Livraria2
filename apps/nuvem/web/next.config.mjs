import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
// output: 'standalone' gera um bundle mínimo p/ a imagem Docker.
// outputFileTracingRoot aponta para a RAIZ do workspace (tres niveis acima) para
// que o standalone inclua os pacotes do workspace (@livraria/*). O Dockerfile
// builda a partir da raiz — server.js fica em apps/nuvem/web/server.js.
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: join(__dirname, "../../.."),
  // Transpila os pacotes do workspace (ADR-0022/0020): TS/TSX + WASM.
  transpilePackages: ["@livraria/ui", "@livraria/domain"],
};

export default nextConfig;

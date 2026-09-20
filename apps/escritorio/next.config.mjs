import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const nuvemApiUrl = process.env.NUVEM_API_URL || "http://api:3001";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fiqzcnnibwzthhjatxvq.supabase.co";

/** @type {import('next').NextConfig} */
// output: 'standalone' gera um bundle mínimo p/ a imagem Docker.
// outputFileTracingRoot aponta para a RAIZ do workspace (dois níveis acima) para
// que o standalone inclua os pacotes do workspace (@livraria/*). O Dockerfile
// builda a partir da raiz — server.js fica em apps/escritorio/server.js.
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: join(__dirname, "../.."),
  // Transpila os pacotes do workspace (ADR-0022/0020): TS/TSX + WASM.
  transpilePackages: ["@livraria/ui", "@livraria/domain"],
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/mcp", destination: `${nuvemApiUrl}/api/v1/ia/mcp` },
        { source: "/mcp/:path*", destination: `${nuvemApiUrl}/api/v1/ia/mcp/:path*` },
        {
          source: "/.well-known/oauth-authorization-server",
          destination: `${nuvemApiUrl}/api/v1/ia/oauth/metadata`,
        },
        {
          source: "/.well-known/oauth-protected-resource",
          destination: `${nuvemApiUrl}/api/v1/ia/oauth/protected-resource`,
        },
        { source: "/auth/v1/:path*", destination: `${supabaseUrl}/auth/v1/:path*` },
        { source: "/rest/v1/:path*", destination: `${supabaseUrl}/rest/v1/:path*` },
        { source: "/api/auth/v1/:path*", destination: `${supabaseUrl}/auth/v1/:path*` },
        { source: "/api/rest/v1/:path*", destination: `${supabaseUrl}/rest/v1/:path*` },
        { source: "/api/api/auth/v1/:path*", destination: `${supabaseUrl}/auth/v1/:path*` },
        { source: "/api/api/rest/v1/:path*", destination: `${supabaseUrl}/rest/v1/:path*` },
        { source: "/api/v1/:path*", destination: `${nuvemApiUrl}/api/v1/:path*` },
        { source: "/api/api/v1/:path*", destination: `${nuvemApiUrl}/api/v1/:path*` },
        { source: "/api/api/auth/:path*", destination: `${nuvemApiUrl}/api/v1/auth/:path*` },
        { source: "/api/api/sync/:path*", destination: `${nuvemApiUrl}/api/v1/sync/:path*` },
        { source: "/api/auth/:path*", destination: `${nuvemApiUrl}/api/v1/auth/:path*` },
        { source: "/api/sync/:path*", destination: `${nuvemApiUrl}/api/v1/sync/:path*` },
        { source: "/api/pdvs/:path*", destination: `${nuvemApiUrl}/api/v1/pdvs/:path*` },
        { source: "/api/produtos-pdv/:path*", destination: `${nuvemApiUrl}/api/v1/produtos-pdv/:path*` },
        { source: "/api/ia/:path*", destination: `${nuvemApiUrl}/api/v1/ia/:path*` },
        { source: "/api/capas/:path*", destination: `${nuvemApiUrl}/api/v1/capas/:path*` },
      ],
      afterFiles: [
        { source: "/api/:path*", destination: `${nuvemApiUrl}/api/v1/:path*` },
        { source: "/auth/:path*", destination: `${nuvemApiUrl}/api/v1/auth/:path*` },
        { source: "/sync/:path*", destination: `${nuvemApiUrl}/api/v1/sync/:path*` },
        { source: "/pdvs/:path*", destination: `${nuvemApiUrl}/api/v1/pdvs/:path*` },
        { source: "/produtos-pdv/:path*", destination: `${nuvemApiUrl}/api/v1/produtos-pdv/:path*` },
      ],
    };
  },
};

export default nextConfig;

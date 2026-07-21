/** @type {import('next').NextConfig} */
// output: 'standalone' gera um bundle mínimo p/ a imagem Docker (Portainer Swarm).
const nextConfig = {
  output: "standalone",
};

export default nextConfig;

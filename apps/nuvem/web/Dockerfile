# App do escritório (Next.js standalone) — build a partir da RAIZ do workspace.
# Contexto de build = raiz do repo: docker build -f apps/nuvem/web/Dockerfile .
# (o Escritório consome @livraria/ui e @livraria/domain, que vivem em packages/.)

FROM node:22-alpine AS deps
WORKDIR /repo
# Só os manifestos do workspace (camada de deps cacheável).
COPY package.json package-lock.json ./
COPY packages/ui/package.json packages/ui/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/contratos/package.json packages/contratos/package.json
COPY apps/pdv/package.json apps/pdv/package.json
COPY apps/nuvem/api/package.json apps/nuvem/api/package.json
COPY apps/nuvem/web/package.json apps/nuvem/web/package.json
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
RUN npm run build -w apps/nuvem/web

FROM node:22-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production
# Standalone tracado com raiz no workspace.
COPY --from=builder /repo/apps/nuvem/web/public ./apps/nuvem/web/public
COPY --from=builder /repo/apps/nuvem/web/.next/standalone ./
COPY --from=builder /repo/apps/nuvem/web/.next/static ./apps/nuvem/web/.next/static
EXPOSE 3000
CMD ["node", "apps/nuvem/web/server.js"]

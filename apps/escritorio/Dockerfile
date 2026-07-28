# App do escritório (Next.js standalone) — build a partir da RAIZ do workspace.
# Contexto de build = raiz do repo:  docker build -f apps/escritorio/Dockerfile .
# (o Escritório consome @livraria/ui e @livraria/domain, que vivem em packages/.)

FROM node:22-alpine AS deps
WORKDIR /repo
# Só os manifestos do workspace (camada de deps cacheável).
COPY package.json package-lock.json ./
COPY packages/ui/package.json packages/ui/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY apps/escritorio/package.json apps/escritorio/package.json
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
# As NEXT_PUBLIC_* precisam existir no build (embutidas no bundle do cliente).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
RUN npm run build -w apps/escritorio

FROM node:22-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production
# Standalone traçado com raiz no workspace: server.js em apps/escritorio/.
COPY --from=builder /repo/apps/escritorio/public ./apps/escritorio/public
COPY --from=builder /repo/apps/escritorio/.next/standalone ./
COPY --from=builder /repo/apps/escritorio/.next/static ./apps/escritorio/.next/static
EXPOSE 3000
CMD ["node", "apps/escritorio/server.js"]

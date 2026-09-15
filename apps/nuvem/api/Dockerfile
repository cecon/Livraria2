FROM node:22-alpine AS builder
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/ui/package.json packages/ui/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/contratos/package.json packages/contratos/package.json
COPY apps/pdv/package.json apps/pdv/package.json
COPY apps/nuvem/web/package.json apps/nuvem/web/package.json
COPY apps/nuvem/api/package.json apps/nuvem/api/package.json
RUN npm ci --ignore-scripts --workspace=@livraria/nuvem-api --include-workspace-root=false
COPY apps/nuvem/api apps/nuvem/api
COPY packages/contratos packages/contratos
RUN npm run db:generate -w @livraria/nuvem-api && npm run build:api
RUN npm prune --omit=dev --ignore-scripts --workspace=@livraria/nuvem-api --include-workspace-root=false

FROM node:22-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/apps/nuvem/api/dist ./apps/nuvem/api/dist
USER node
EXPOSE 3001
CMD ["node", "apps/nuvem/api/dist/main.js"]

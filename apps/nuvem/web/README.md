# App do escritorio

Next.js App Router integrado exclusivamente a API NestJS. A autenticacao e os
dados administrativos passam pelo backend, sem acesso direto do navegador ao banco.

## Rodar local

```bash
cd apps/nuvem/web
cp .env.example .env.local
npm install
npm run dev
```

## Build manual da imagem

```bash
docker build -f apps/nuvem/web/Dockerfile -t livraria-escritorio:latest .
```

## Auto-update local/prod-local com Docker Desktop

O workflow `.github/workflows/web-images.yml` publica, a cada merge na `main`,
tres imagens no GHCR:

- `ghcr.io/cecon/livraria2-escritorio:latest`
- `ghcr.io/cecon/livraria2-nuvem-api:latest`
- `ghcr.io/cecon/livraria2-migrator:latest`

O arquivo `apps/nuvem/web/stack.yml` e um Docker Compose para Docker Desktop e
sobe quatro containers:

- `migrator`: aplica migrations do Supabase e registra hash em
  `public.livraria_schema_migrations`.
- `api`: backend NestJS da nuvem.
- `escritorio`: app Next.js standalone.
- `watchtower`: observa imagens com label e recria containers quando `:latest`
  muda.

Variaveis exigidas no ambiente do Docker Desktop/Compose:

```text
ESCRITORIO_PORT=47612
NUVEM_DATABASE_URL=...
API_JWT_SECRET=...
SUPABASE_DB_PASSWORD=...
MIGRATION_BASELINE_UP_TO=0011_estoque_oficial_venda
```

Depois que a tabela de controle existir, `MIGRATION_BASELINE_UP_TO` pode ser
mantida; novas migrations `0012_*`, `0013_*` etc. serao aplicadas normalmente.

Subir/atualizar no Docker Desktop:

```bash
docker compose -f apps/nuvem/web/stack.yml pull
docker compose -f apps/nuvem/web/stack.yml up -d
```

## Telas

- `/login`: entrar
- `/`: home com navegacao
- `/cadastro`: cadastro oficial de produtos

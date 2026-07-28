# App do escritorio

Next.js App Router + Supabase (`@supabase/ssr`). Autentica por usuario
Supabase Auth e fala com a nuvem `fiqzcnnibwzthhjatxvq` sob RLS.

## Rodar local

```bash
cd apps/escritorio
cp .env.example .env.local
npm install
npm run dev
```

## Build manual da imagem

```bash
docker build -f apps/escritorio/Dockerfile \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://fiqzcnnibwzthhjatxvq.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable> \
  -t livraria-escritorio:latest .
```

## Auto-update local/prod-local com Docker Desktop

O workflow `.github/workflows/web-images.yml` publica, a cada merge na `main`,
duas imagens no GHCR:

- `ghcr.io/cecon/livraria2-escritorio:latest`
- `ghcr.io/cecon/livraria2-migrator:latest`

O arquivo `apps/escritorio/stack.yml` e um Docker Compose para Docker Desktop e
sobe tres containers:

- `migrator`: aplica migrations do Supabase e registra hash em
  `public.livraria_schema_migrations`.
- `escritorio`: app Next.js standalone.
- `watchtower`: observa imagens com label e recria containers quando `:latest`
  muda.

Variaveis exigidas no ambiente do Docker Desktop/Compose:

```text
ESCRITORIO_PORT=47612
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
ESCRITORIO_EMAIL=...
ESCRITORIO_SENHA=...
SUPABASE_DB_PASSWORD=...
MIGRATION_BASELINE_UP_TO=0011_estoque_oficial_venda
```

Depois que a tabela de controle existir, `MIGRATION_BASELINE_UP_TO` pode ser
mantida; novas migrations `0012_*`, `0013_*` etc. serao aplicadas normalmente.

Subir/atualizar no Docker Desktop:

```bash
docker compose -f apps/escritorio/stack.yml pull
docker compose -f apps/escritorio/stack.yml up -d
```

## Telas

- `/login`: entrar
- `/`: home com navegacao
- `/cadastro`: cadastro oficial de produtos
- `/estoque/divergencias`: revisao administrativa de divergencias

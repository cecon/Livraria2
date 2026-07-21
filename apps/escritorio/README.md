# App do escritório (retaguarda) — feature 007

Next.js (App Router) + Supabase (`@supabase/ssr`). Autentica por usuário (Supabase Auth),
fala com a nuvem `fiqzcnnibwzthhjatxvq` sob RLS. Hospedado como container no Portainer Swarm.

## Rodar local
```bash
cd apps/escritorio
cp .env.example .env.local   # preencha a PUBLISHABLE_KEY (Notion)
npm install
npm run dev                  # http://localhost:3000
```

## Build da imagem (Swarm)
```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://fiqzcnnibwzthhjatxvq.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable> \
  -t livraria-escritorio:latest apps/escritorio
```
Publique como serviço no Portainer (porta 3000).

## Telas
- `/login` — entrar (Supabase Auth) ✅
- `/` — home com navegação ✅
- `/recebimento` — receber livros (US1) — **a implementar**
- `/fornecedores`, `/livros`, `/consulta` — próximos incrementos

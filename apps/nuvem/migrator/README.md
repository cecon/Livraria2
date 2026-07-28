# Migrator da nuvem

Container de migrations para o ambiente web local/prod-local. Ele aplica arquivos
`apps/nuvem/migrations/*.sql` no Supabase vinculado e registra hash em
`public.livraria_schema_migrations`.

No primeiro deploy contra o prod atual, usar:

```text
MIGRATION_BASELINE_UP_TO=0011_estoque_oficial_venda
```

Assim o migrator marca `0001..0011` como baseline, porque esses arquivos ja foram
aplicados manualmente. Migrations futuras, como `0012_*.sql`, serao aplicadas
automaticamente quando a imagem nova for puxada pelo Watchtower.

Segredos exigidos no runtime:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`

Eles ficam na memoria operacional/Portainer, nunca no repositorio.

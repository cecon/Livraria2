# Migrações do schema na nuvem (Supabase — feature 007)

Schema **espelho** do SQLite local, aplicado no projeto Supabase `fiqzcnnibwzthhjatxvq` (livraria, `ca-central-1`).

Aplicadas via Management API (`POST /v1/projects/{ref}/database/query`) — token no Notion (Memória do Projeto), **nunca** no repo.

| Arquivo | Conteúdo | Status |
|---|---|---|
| `0001_schema_espelho.sql` | 13 tabelas espelho. **Relações por `sync_uid`** (não por id local — ids autoincrement não são estáveis entre PDV e escritório). Derivados (`estoque`, `custo_medio`) NÃO existem como coluna. `usuario` **sem `senha_hash`** (D15). Colunas de sync: `origem/atualizado_em/excluido_em/criado_por/sincronizado_em`. | ✅ aplicado (T008) |
| `0002_rls_e_views.sql` | RLS por usuário autenticado (13 policies `to authenticated`) + `vw_saldo_livro` (soma dos movimentos). | ✅ aplicado (T009) |

## Decisão-chave: FK por `sync_uid`

As tabelas-filhas referenciam os pais por **`<pai>_uid uuid REFERENCES pai(sync_uid)`** (ex.: `movimento_estoque.livro_uid`, `pagamento_pedido.forma_uid`, `pedido.operador_uid`). O adapter de sync do PDV (T012/T013) faz o **remap**: ao empurrar, traduz o id local do pai → `sync_uid`; ao aplicar um pull, traduz `sync_uid` → id local.

## Pendente

- `vw_custo_medio`: o custo médio ponderado (ADR-0009) é um **fold ordenado por `criado_em`** — não é um `avg` simples. Fica para quando o recompute do adapter existir (será a fonte autoritativa); a view exata entra depois.
- **Auth**: criar os usuários (retaguarda) e o usuário de serviço do PDV via Supabase Auth.

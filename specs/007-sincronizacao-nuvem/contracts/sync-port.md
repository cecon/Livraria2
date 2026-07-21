# Contrato — Porta de Sincronização (SyncPort) e comandos Tauri

Camada de aplicação. O domínio não conhece a nuvem; ele expõe **portas** implementadas pelo adapter `adapters/nuvem/supabase_sync.rs`.

## Porta `SyncPort` (application/ports_sync.rs)

Conceitual (assinaturas finais na implementação):

- `enviar_pendentes(recurso) -> Result<ResumoPush>` — envia (upsert por `sync_uid`) as linhas locais com `sincronizado_em IS NULL`, na **ordem pais→filhas**; marca as enviadas; retorna contagem + **órfãs isoladas** (não abortam o lote).
- `puxar_desde(recurso, last_cursor) -> Result<LotePull>` — busca da nuvem as linhas com `sincronizado_em > last_cursor`; retorna deltas + novo cursor.
- `aplicar_delta(lote) -> Result<()>` — upsert local por `sync_uid`; para `livro`, aplica **LWW** por `atualizado_em`; respeita soft delete.

## Porta `RelogioServidor` (application/ports_sync.rs)

- `agora_servidor() -> Result<Instante>` — tempo confiável para carimbar `atualizado_em`/cursor (D9). O adapter usa o retorno do servidor; nunca o relógio local como autoridade.

## Caso de uso `sincronizar` (application/sincronizacao.rs)

Orquestra, de forma idempotente e retomável:

1. `enviar_pendentes` de cada recurso (pais→filhas).
2. `puxar_desde(cursor)` de cada recurso; `aplicar_delta`.
3. **Recomputar derivados** (`custo_medio`) por fold do ledger nos livros afetados (D5).
4. Persistir `last_cursor` em `sync_cursor`.

Falha de rede em qualquer passo é segura: nada duplica no re-run (upsert por `sync_uid`); passo interrompido retoma do cursor.

## Comandos Tauri (commands_sync.rs)

| Comando | Entrada | Saída | Notas |
|---|---|---|---|
| `sincronizar_agora` | — | `ResumoSync { enviados, recebidos, orfas, quando }` | Disparo manual; também chamado pelo agendador em background. |
| `seed_inicial` | — | `ResumoSeed { enviados_por_tabela, orfas }` | Carga inicial idempotente do histórico completo (D13); reusa o push de pendentes. |
| `status_sincronizacao` | — | `StatusSync { pendentes, ultima_sync, online, orfas }` | Alimenta o indicador de estado (FR-014). |

- Nenhum comando expõe credenciais; o token de usuário (Supabase Auth) fica em configuração do adapter, nunca `service_role`, nunca no front.
- Background: o PDV agenda `sincronizar_agora` periodicamente quando `online`; a venda **nunca** bloqueia por sync (FR-002).

# Contrato — Escritório: visão e fechamento de turnos

Base: `apps/escritorio` (Next.js, lê Postgres via Supabase autenticado + RLS) + `apps/nuvem`
(migração de backfill). Sem segredo administrativo no cliente.

## Visão de turnos (FR-018)
Página que lista **todos** os turnos (abertos e fechados) de todos os PDVs, a qualquer momento.

Fonte: tabela `turno_operacao` (+ agregação de `pedido` por `turno_uid`).

Por turno, exibir:
- `maquina` (PC), `operador` (quem abriu), `status` (aberto/encerrado), `abertura`/`encerramento`,
- totais: nº de vendas, valor, e (se encerrado) `esperado/conferido/diferenca`.
- Filtros: por status, máquina, período. Distinguível por `maquina`/`operador` (SC-011/SC-012).

A **abertura** de turno já sobe (não só o fechamento) para aparecer como "aberto".

## Fechar turno (FR-019)
Ação **"Fechar turno"** disponível a **qualquer usuário do escritório** (sem gate de perfil).
- Efeito na nuvem: `UPDATE turno_operacao SET status='encerrado', encerramento=now(), atualizado_em=now()`
  para o `sync_uid` do turno (LWW).
- Propaga ao PDV no próximo pull (ver `sync-push-only.md` → reconciliação FR-024).

## Backfill do turno padrão global (FR-014) — `apps/nuvem/migrations/0014_*.sql`
Idempotente:
```sql
-- 1) turno padrão global (fechado/conferido), identidade determinística (sem duplicar em re-run)
INSERT INTO turno_operacao (sync_uid, operador, status, abertura, encerramento, ...)
SELECT <uuid_deterministico>, 'sistema', 'encerrado', <data>, <data>, ...
WHERE NOT EXISTS (SELECT 1 FROM turno_operacao WHERE sync_uid = <uuid_deterministico>);

-- 2) vincular todas as vendas órfãs
UPDATE pedido SET turno_uid = <uuid_deterministico> WHERE turno_uid IS NULL;
```
Pós-condição: `SELECT count(*) FROM pedido WHERE turno_uid IS NULL` = **0** (SC-009). Homologar em `apps/nuvem/tests/`.

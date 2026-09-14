-- Validacao manual da migracao 0015_turno_padrao_backfill.sql (feature 013, T029).
--
-- Execute em homologacao, nunca em producao:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/nuvem/migrations/0014_turno_maquina.sql
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/nuvem/migrations/0015_turno_padrao_backfill.sql
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/nuvem/tests/0015_turno_padrao_backfill.sql
--
-- Prova: (a) backfill idempotente, (b) ZERO pedidos sem turno depois (SC-009),
-- (c) venda que ja tinha turno NAO e re-carimbada. Faz rollback no final.

\i apps/nuvem/migrations/0015_turno_padrao_backfill.sql

begin;

-- Fixture: um turno real e tres vendas — duas orfas (pre-013) e uma ja vinculada.
insert into turno_operacao (sync_uid, caixa_inicial_centavos, status, abertura, origem, atualizado_em)
values ('00000000-0015-0000-0000-000000000009', 0, 'encerrado', '2026-08-01T09:00:00', 'pdv', now())
on conflict (sync_uid) do nothing;

insert into pedido (sync_uid, numero, cliente, turno, data, total_centavos, cancelado, turno_uid, origem, atualizado_em)
values
  ('00000000-0015-1000-0000-000000000001', 900001, 'TESTE 0015 A', 'manha', '2026-01-10', 1000, false, null, 'pdv', now()),
  ('00000000-0015-1000-0000-000000000002', 900002, 'TESTE 0015 B', 'tarde', '2026-01-11', 2000, false, null, 'pdv', now()),
  ('00000000-0015-1000-0000-000000000003', 900003, 'TESTE 0015 C', 'manha', '2026-08-01', 3000, false,
   '00000000-0015-0000-0000-000000000009', 'pdv', now());

-- Reaplica o backfill (2a passada) — idempotencia.
update pedido
   set turno_uid = '00000000-0013-0000-0000-000000000001'
 where turno_uid is null;

do $$
declare
  v_orfas bigint;
  v_padrao bigint;
  v_intacta text;
  v_turnos_padrao bigint;
begin
  -- (b) SC-009: nenhum pedido sem turno.
  select count(*) into v_orfas from pedido where turno_uid is null;
  if v_orfas <> 0 then
    raise exception 'FALHOU: % pedido(s) ainda sem turno', v_orfas;
  end if;

  -- (a) as duas orfas foram para o turno padrao.
  select count(*) into v_padrao
    from pedido
   where sync_uid in ('00000000-0015-1000-0000-000000000001','00000000-0015-1000-0000-000000000002')
     and turno_uid = '00000000-0013-0000-0000-000000000001';
  if v_padrao <> 2 then
    raise exception 'FALHOU: esperava 2 vendas no turno padrao, veio %', v_padrao;
  end if;

  -- (c) a venda que ja tinha turno nao foi re-carimbada.
  select turno_uid::text into v_intacta
    from pedido where sync_uid = '00000000-0015-1000-0000-000000000003';
  if v_intacta <> '00000000-0015-0000-0000-000000000009' then
    raise exception 'FALHOU: venda com turno proprio foi re-carimbada (%)', v_intacta;
  end if;

  -- O turno padrao e unico (o insert e on conflict do nothing).
  select count(*) into v_turnos_padrao
    from turno_operacao where sync_uid = '00000000-0013-0000-0000-000000000001';
  if v_turnos_padrao <> 1 then
    raise exception 'FALHOU: turno padrao duplicado (%)', v_turnos_padrao;
  end if;

  raise notice 'OK 0015: backfill idempotente, zero pedidos sem turno, venda com turno preservada.';
end $$;

rollback;

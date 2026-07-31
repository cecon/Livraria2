-- Validacao manual da migracao 0015_ajustar_inventario.sql.
--
-- Execute em homologacao, nunca em producao:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/nuvem/migrations/0015_ajustar_inventario.sql
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/nuvem/tests/0015_ajustar_inventario.sql
--
-- Prova: o ajuste leva o saldo oficial a contagem (delta) e e idempotente por
-- (sessao, livro). Faz rollback no final.

\i apps/nuvem/migrations/0015_ajustar_inventario.sql

begin;

insert into usuario (sync_uid, usuario, perfil)
values ('00000000-0015-0000-0000-0000000000ad', 'admin-teste-0015', 'admin');

insert into livro (sync_uid, codigo, titulo, preco_centavos, categoria, busca_norm, ativo, origem)
values ('00000000-0015-0000-0000-000000000001', 'TESTE-0015', 'Produto teste 0015', 1000, 0, 'produto teste 0015', true, 'escritorio');

-- saldo inicial 4
insert into movimento_estoque (sync_uid, livro_uid, tipo, qtd)
values (gen_random_uuid(), '00000000-0015-0000-0000-000000000001', 'entrada', 4);

-- conta 10 -> delta +6; duas chamadas identicas nao duplicam.
select ajustar_inventario('admin-teste-0015', 'SESSAO-0015',
  '[{"codigo":"TESTE-0015","contado":10}]'::jsonb);
select ajustar_inventario('admin-teste-0015', 'SESSAO-0015',
  '[{"codigo":"TESTE-0015","contado":10}]'::jsonb);

do $$
declare v_saldo bigint; n int; d bigint;
begin
  select saldo into v_saldo from vw_saldo_livro where codigo = 'TESTE-0015';
  select count(*), coalesce(sum(qtd), 0) into n, d
    from movimento_estoque where referencia = 'SESSAO-0015' and tipo = 'ajuste';
  if v_saldo <> 10 then
    raise exception 'inventario: saldo esperado 10 (contado), veio %', v_saldo;
  end if;
  if n <> 1 or d <> 6 then
    raise exception 'inventario: esperava 1 ajuste de +6, veio n=% d=%', n, d;
  end if;
end $$;

-- contagem igual ao saldo => sem ajuste (delta 0).
select ajustar_inventario('admin-teste-0015', 'SESSAO-0015-B',
  '[{"codigo":"TESTE-0015","contado":10}]'::jsonb);
do $$
declare n int;
begin
  select count(*) into n from movimento_estoque where referencia = 'SESSAO-0015-B' and tipo = 'ajuste';
  if n <> 0 then
    raise exception 'inventario: contagem igual ao saldo nao deveria gerar ajuste, veio %', n;
  end if;
end $$;

rollback;

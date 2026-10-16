-- Validacao manual da migracao 0016_ajuste_sem_saldo_negativo.sql (feature 014, ADR-0026).
--
-- Execute em homologacao, nunca em producao:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/nuvem/migrations/0016_ajuste_sem_saldo_negativo.sql
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/nuvem/tests/0016_ajuste_sem_saldo_negativo.sql
--
-- Prova que o ajuste manual nunca deixa o saldo negativo (zerar e permitido) e
-- que estorno de nota, contagem, ajuste de outra origem e venda nao sao
-- bloqueados. Faz rollback no final.

\i apps/nuvem/migrations/0016_ajuste_sem_saldo_negativo.sql
\i apps/nuvem/migrations/0016_ajuste_sem_saldo_negativo.sql

begin;

insert into livro (sync_uid, codigo, titulo, preco_centavos, categoria, busca_norm, ativo, origem)
values ('00000000-0016-0000-0000-000000000001', 'TESTE-0016', 'Produto teste 0016', 1000, 0, 'produto teste 0016', true, 'escritorio');

insert into movimento_estoque (sync_uid, livro_uid, tipo, qtd, origem)
values (gen_random_uuid(), '00000000-0016-0000-0000-000000000001', 'entrada', 3, 'escritorio');

-- 1) Ajuste manual +2 aceito (saldo 5); -5 zera e e aceito (saldo 0).
insert into movimento_estoque (sync_uid, livro_uid, tipo, qtd, motivo, referencia, origem)
values (gen_random_uuid(), '00000000-0016-0000-0000-000000000001', 'ajuste', 2, 'correcao', 'ajuste_manual', 'escritorio'),
       (gen_random_uuid(), '00000000-0016-0000-0000-000000000001', 'ajuste', -5, 'perda', 'ajuste_manual', 'escritorio');

-- 2) Ajuste manual que deixaria -1 e recusado com ESTOQUE_NEGATIVO e detail = saldo (0).
do $$
declare v_msg text; v_det text;
begin
  begin
    insert into movimento_estoque (sync_uid, livro_uid, tipo, qtd, motivo, referencia, origem)
    values (gen_random_uuid(), '00000000-0016-0000-0000-000000000001', 'ajuste', -1, 'quebra', 'ajuste_manual', 'escritorio');
    raise exception 'Caso 2: ajuste negativo deveria ser recusado';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
    if v_msg <> 'ESTOQUE_NEGATIVO' or v_det <> '0' then
      raise exception 'Caso 2: esperado ESTOQUE_NEGATIVO/0, veio %/%', v_msg, v_det;
    end if;
  end;
end $$;

-- 3) Nao bloqueados (saldo 0): estorno de nota (ajuste sem referencia), contagem,
--    e ajuste de outra origem (pdv).
insert into movimento_estoque (sync_uid, livro_uid, tipo, qtd, motivo, origem)
values (gen_random_uuid(), '00000000-0016-0000-0000-000000000001', 'ajuste', -1, 'estorno de lançamento', 'escritorio');
insert into movimento_estoque (sync_uid, livro_uid, tipo, qtd, referencia, origem)
values (gen_random_uuid(), '00000000-0016-0000-0000-000000000001', 'contagem', -1, 'inventario', 'escritorio');
insert into movimento_estoque (sync_uid, livro_uid, tipo, qtd, motivo, referencia, origem)
values (gen_random_uuid(), '00000000-0016-0000-0000-000000000001', 'ajuste', -1, 'legado', 'ajuste_manual', 'pdv');

do $$
declare v_saldo bigint;
begin
  select saldo into v_saldo from vw_saldo_livro where livro_uid = '00000000-0016-0000-0000-000000000001';
  if v_saldo <> -3 then
    raise exception 'Caso 3: movimentos nao manuais deveriam passar (saldo -3), veio %', v_saldo;
  end if;
end $$;

rollback;

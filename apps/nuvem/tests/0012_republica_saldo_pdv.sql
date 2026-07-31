-- Validacao manual da migracao 0012_republica_saldo_pdv.sql.
--
-- Execute em homologacao, nunca em producao:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/nuvem/migrations/0012_republica_saldo_pdv.sql
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/nuvem/tests/0012_republica_saldo_pdv.sql
--
-- Prova que mudanca de estoque oficial RE-PUBLICA o produto para o PDV
-- (livro.sincronizado_em avanca -> vw_produto_pdv publica saldo novo com
-- timestamp novo) e que a migracao e idempotente. Faz rollback no final.

\i apps/nuvem/migrations/0012_republica_saldo_pdv.sql

begin;

-- Produto de teste com marca de publicacao ANTIGA (simula livro ja sincronizado).
insert into livro (sync_uid, codigo, titulo, preco_centavos, categoria, busca_norm, ativo, origem, sincronizado_em)
values ('00000000-0012-0000-0000-000000000001', 'TESTE-0012-A', 'Produto teste 0012 A', 1000, 0, 'produto teste 0012 a', true, 'escritorio', '2000-01-01T00:00:00Z');

-- Mudanca de estoque oficial: o trigger deve bumpar livro.sincronizado_em.
insert into movimento_estoque (sync_uid, livro_uid, tipo, qtd)
values (gen_random_uuid(), '00000000-0012-0000-0000-000000000001', 'entrada', 7);

do $$
declare v_sync timestamptz; v_saldo bigint; v_pub timestamptz;
begin
  select sincronizado_em into v_sync from livro where sync_uid = '00000000-0012-0000-0000-000000000001';
  if v_sync <= '2000-01-02T00:00:00Z' then
    raise exception 'livro.sincronizado_em deveria ter avancado apos movimento, encontrado %', v_sync;
  end if;

  select saldo_publicado, sincronizado_em into v_saldo, v_pub
    from vw_produto_pdv where livro_uid = '00000000-0012-0000-0000-000000000001';
  if v_saldo <> 7 then
    raise exception 'saldo_publicado esperado 7, encontrado %', v_saldo;
  end if;
  if v_pub <= '2000-01-02T00:00:00Z' then
    raise exception 'vw_produto_pdv deveria republicar com timestamp novo, encontrado %', v_pub;
  end if;
end $$;

-- Segunda mudanca de estoque volta a republicar (timestamp cresce de novo).
do $$
declare v_antes timestamptz; v_depois timestamptz;
begin
  select sincronizado_em into v_antes from livro where sync_uid = '00000000-0012-0000-0000-000000000001';
  perform pg_sleep(0.01);
  insert into movimento_estoque (sync_uid, livro_uid, tipo, qtd)
  values (gen_random_uuid(), '00000000-0012-0000-0000-000000000001', 'saida_venda', -2);
  select sincronizado_em into v_depois from livro where sync_uid = '00000000-0012-0000-0000-000000000001';
  if v_depois <= v_antes then
    raise exception 'sincronizado_em deveria crescer a cada movimento (antes=% depois=%)', v_antes, v_depois;
  end if;
end $$;

-- Idempotencia: reaplicar a migracao nao duplica o trigger nem falha.
\i apps/nuvem/migrations/0012_republica_saldo_pdv.sql

do $$
declare n int;
begin
  select count(*) into n from pg_trigger
   where tgname = 'trg_mov_republica_livro' and not tgisinternal;
  if n <> 1 then
    raise exception 'esperado exatamente 1 trigger trg_mov_republica_livro, encontrado %', n;
  end if;
end $$;

rollback;

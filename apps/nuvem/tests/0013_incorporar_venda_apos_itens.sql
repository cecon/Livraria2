-- Validacao manual da migracao 0013_incorporar_venda_apos_itens.sql.
--
-- Execute em homologacao, nunca em producao:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/nuvem/migrations/0011_estoque_oficial_venda.sql
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/nuvem/migrations/0012_republica_saldo_pdv.sql
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/nuvem/migrations/0013_incorporar_venda_apos_itens.sql
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/nuvem/tests/0013_incorporar_venda_apos_itens.sql
--
-- Prova que a incorporacao tolera a corrida de sync (pedido pronta chega ANTES
-- dos itens): o pedido sem itens NAO vira divergente; quando o item chega, a
-- baixa acontece e o saldo republica. Faz rollback no final.

\i apps/nuvem/migrations/0013_incorporar_venda_apos_itens.sql

begin;

insert into livro (sync_uid, codigo, titulo, preco_centavos, categoria, busca_norm, ativo, origem, sincronizado_em)
values ('00000000-0013-0000-0000-000000000001', 'TESTE-0013', 'Produto teste 0013', 1000, 0, 'produto teste 0013', true, 'escritorio', '2000-01-01T00:00:00Z');

insert into movimento_estoque (sync_uid, livro_uid, tipo, qtd)
values (gen_random_uuid(), '00000000-0013-0000-0000-000000000001', 'entrada', 5);

-- Fase A: pedido pronta chega SEM itens (corrida de sync) -> deve seguir 'pronta'.
insert into pedido (sync_uid, numero, turno, data, total_centavos, estoque_status, cancelado, origem)
values ('00000000-0013-0000-0000-000000000002', 999999, 'T', '2026-07-30', 1000, 'pronta', false, 'pdv');

do $$
declare st text; nmov int;
begin
  select estoque_status into st from pedido where sync_uid = '00000000-0013-0000-0000-000000000002';
  select count(*) into nmov from movimento_estoque where pedido_uid = '00000000-0013-0000-0000-000000000002';
  if st <> 'pronta' then
    raise exception 'Fase A: pedido sem itens deveria seguir pronta, veio %', st;
  end if;
  if nmov <> 0 then
    raise exception 'Fase A: nao deveria haver baixa antes dos itens, veio %', nmov;
  end if;
end $$;

-- Fase B: itens chegam depois -> incorpora (baixa + republica).
insert into item_pedido (sync_uid, pedido_uid, codigo, titulo, preco_centavos, qtd)
values ('00000000-0013-0000-0000-000000000003', '00000000-0013-0000-0000-000000000002', 'TESTE-0013', 'Produto teste 0013', 1000, 1);

do $$
declare st text; nbaixa int; v_saldo bigint; v_pub timestamptz;
begin
  select estoque_status into st from pedido where sync_uid = '00000000-0013-0000-0000-000000000002';
  select count(*) into nbaixa from movimento_estoque
   where pedido_uid = '00000000-0013-0000-0000-000000000002' and tipo = 'saida_venda';
  select saldo_publicado, sincronizado_em into v_saldo, v_pub
   from vw_produto_pdv where codigo = 'TESTE-0013';
  if st <> 'incorporada' then
    raise exception 'Fase B: pedido deveria ficar incorporada, veio %', st;
  end if;
  if nbaixa <> 1 then
    raise exception 'Fase B: esperado 1 saida_venda, veio %', nbaixa;
  end if;
  if v_saldo <> 4 then
    raise exception 'Fase B: saldo_publicado esperado 4 (5-1), veio %', v_saldo;
  end if;
  if v_pub <= '2000-01-02T00:00:00Z' then
    raise exception 'Fase B: livro deveria ter republicado (timestamp novo), veio %', v_pub;
  end if;
end $$;

-- Idempotencia: reprocessar nao duplica baixa.
do $$
declare nbaixa int;
begin
  perform incorporar_pedido('00000000-0013-0000-0000-000000000002');
  select count(*) into nbaixa from movimento_estoque
   where pedido_uid = '00000000-0013-0000-0000-000000000002' and tipo = 'saida_venda';
  if nbaixa <> 1 then
    raise exception 'Idempotencia: reprocessar deveria manter 1 baixa, veio %', nbaixa;
  end if;
end $$;

rollback;

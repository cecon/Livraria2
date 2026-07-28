-- Validacao manual da migracao 0011_estoque_oficial_venda.sql.
--
-- Execute em homologacao, nunca em producao:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/nuvem/migrations/0011_estoque_oficial_venda.sql
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/nuvem/tests/0011_estoque_oficial_venda.sql
--
-- O arquivo reaplica a migracao para provar idempotencia e faz rollback dos dados
-- de teste no final.

\i apps/nuvem/migrations/0011_estoque_oficial_venda.sql

begin;

insert into livro (sync_uid, codigo, titulo, preco_centavos, categoria, busca_norm, ativo, origem)
values
  ('00000000-0011-0000-0000-000000000001', 'TESTE-0011-A', 'Produto teste 0011 A', 1000, 0, 'produto teste 0011 a', true, 'escritorio'),
  ('00000000-0011-0000-0000-000000000002', 'TESTE-0011-B', 'Produto teste 0011 B', 1000, 0, 'produto teste 0011 b', true, 'escritorio'),
  ('00000000-0011-0000-0000-000000000003', 'TESTE-0011-C', 'Produto teste 0011 C', 1000, 0, 'produto teste 0011 c', true, 'escritorio'),
  ('00000000-0011-0000-0000-000000000004', 'TESTE-0011-D', 'Produto teste 0011 D', 1000, 0, 'produto teste 0011 d', false, 'escritorio');

insert into movimento_estoque (sync_uid, livro_uid, tipo, qtd, motivo, referencia, criado_em, origem)
values
  ('00000000-0011-1000-0000-000000000001', '00000000-0011-0000-0000-000000000001', 'ajuste', 10, 'fixture 0011', 'fixture', now()::text, 'escritorio'),
  ('00000000-0011-1000-0000-000000000002', '00000000-0011-0000-0000-000000000002', 'ajuste', 1, 'fixture 0011', 'fixture', now()::text, 'escritorio'),
  ('00000000-0011-1000-0000-000000000004', '00000000-0011-0000-0000-000000000004', 'ajuste', 3, 'fixture 0011', 'fixture', now()::text, 'escritorio');

select capturar_saldo_partida_producao();

do $$
declare n bigint;
begin
  select count(*) into n from saldo_partida_producao where livro_uid = '00000000-0011-0000-0000-000000000001';
  if n <> 1 then
    raise exception 'baseline deveria ter uma linha para produto A, encontrado %', n;
  end if;
end $$;

-- Venda rascunho/parcial nao movimenta estoque antes do marcador pronta.
insert into pedido (sync_uid, numero, cliente, turno, data, total_centavos, origem)
values ('00000000-0011-2000-0000-000000000001', 11001, 'CLIENTE', 'T1', '2026-07-28', 2000, 'pdv');

insert into item_pedido (sync_uid, pedido_uid, codigo, titulo, preco_centavos, qtd, origem)
values ('00000000-0011-3000-0000-000000000001', '00000000-0011-2000-0000-000000000001', 'TESTE-0011-A', 'Produto teste 0011 A', 1000, 2, 'pdv');

do $$
declare n bigint;
begin
  select count(*) into n from movimento_estoque where item_pedido_uid = '00000000-0011-3000-0000-000000000001';
  if n <> 0 then
    raise exception 'rascunho nao deveria criar saida_venda, encontrado %', n;
  end if;
end $$;

-- Venda pronta cria uma unica saida_venda pela quantidade total.
update pedido
   set estoque_status = 'pronta',
       estoque_pronta_em = now()
 where sync_uid = '00000000-0011-2000-0000-000000000001';

do $$
declare n bigint; qtd bigint; status text;
begin
  select count(*), coalesce(sum(m.qtd), 0) into n, qtd
  from movimento_estoque m
  where item_pedido_uid = '00000000-0011-3000-0000-000000000001'
    and tipo = 'saida_venda';
  if n <> 1 or qtd <> -2 then
    raise exception 'saida_venda esperada n=1/qtd=-2, encontrado n=% qtd=%', n, qtd;
  end if;

  select estoque_status into status from pedido where sync_uid = '00000000-0011-2000-0000-000000000001';
  if status <> 'incorporada' then
    raise exception 'pedido deveria ficar incorporada, encontrado %', status;
  end if;
end $$;

-- Reprocessar a mesma venda pronta nao duplica movimento.
update pedido
   set estoque_status = 'pronta'
 where sync_uid = '00000000-0011-2000-0000-000000000001';

do $$
declare n bigint;
begin
  select count(*) into n
  from movimento_estoque
  where item_pedido_uid = '00000000-0011-3000-0000-000000000001'
    and tipo = 'saida_venda';
  if n <> 1 then
    raise exception 'reprocessamento duplicou saida_venda: %', n;
  end if;
end $$;

-- Saldo insuficiente baixa integralmente e registra divergencia aberta.
insert into pedido (sync_uid, numero, cliente, turno, data, total_centavos, origem, estoque_status)
values ('00000000-0011-2000-0000-000000000002', 11002, 'CLIENTE', 'T1', '2026-07-28', 5000, 'pdv', 'rascunho');

insert into item_pedido (sync_uid, pedido_uid, codigo, titulo, preco_centavos, qtd, origem)
values ('00000000-0011-3000-0000-000000000002', '00000000-0011-2000-0000-000000000002', 'TESTE-0011-B', 'Produto teste 0011 B', 1000, 5, 'pdv');

update pedido set estoque_status = 'pronta' where sync_uid = '00000000-0011-2000-0000-000000000002';

do $$
declare v_saldo bigint; divs bigint;
begin
  select saldo into v_saldo from vw_saldo_livro where livro_uid = '00000000-0011-0000-0000-000000000002';
  select count(*) into divs
  from divergencia_estoque
  where pedido_uid = '00000000-0011-2000-0000-000000000002'
    and tipo = 'saldo_negativo'
    and status = 'aberta';

  if v_saldo <> -4 or divs <> 1 then
    raise exception 'saldo negativo/divergencia esperados saldo=-4 divs=1, encontrado saldo=% divs=%', v_saldo, divs;
  end if;
end $$;

-- Produto inativo vendido por evento offline gera divergencia, sem apagar venda.
insert into pedido (sync_uid, numero, cliente, turno, data, total_centavos, origem)
values ('00000000-0011-2000-0000-000000000004', 11004, 'CLIENTE', 'T1', '2026-07-28', 1000, 'pdv');

insert into item_pedido (sync_uid, pedido_uid, codigo, titulo, preco_centavos, qtd, origem)
values ('00000000-0011-3000-0000-000000000004', '00000000-0011-2000-0000-000000000004', 'TESTE-0011-D', 'Produto teste 0011 D', 1000, 1, 'pdv');

update pedido set estoque_status = 'pronta' where sync_uid = '00000000-0011-2000-0000-000000000004';

do $$
declare divs bigint;
begin
  select count(*) into divs
  from divergencia_estoque
  where pedido_uid = '00000000-0011-2000-0000-000000000004'
    and tipo = 'produto_inativo'
    and status = 'aberta';
  if divs <> 1 then
    raise exception 'produto inativo deveria gerar uma divergencia, encontrado %', divs;
  end if;
end $$;

-- Cancelamento estorna exatamente uma vez os movimentos originais.
update pedido
   set cancelado = true,
       cancelado_em = now()
 where sync_uid = '00000000-0011-2000-0000-000000000001';

update pedido
   set cancelado = true,
       cancelado_em = now()
 where sync_uid = '00000000-0011-2000-0000-000000000001';

do $$
declare n bigint; qtd bigint; status text;
begin
  select count(*), coalesce(sum(m.qtd), 0) into n, qtd
  from movimento_estoque m
  where pedido_uid = '00000000-0011-2000-0000-000000000001'
    and tipo = 'estorno_venda';
  if n <> 1 or qtd <> 2 then
    raise exception 'estorno esperado n=1/qtd=2, encontrado n=% qtd=%', n, qtd;
  end if;

  select estoque_status into status from pedido where sync_uid = '00000000-0011-2000-0000-000000000001';
  if status <> 'cancelada_estornada' then
    raise exception 'pedido deveria ficar cancelada_estornada, encontrado %', status;
  end if;
end $$;

-- Auditoria pre/post: baseline permanece como marco, saldo oficial reflete apenas eventos novos.
do $$
declare v_baseline bigint; v_saldo_atual bigint;
begin
  select saldo into v_baseline from saldo_partida_producao where livro_uid = '00000000-0011-0000-0000-000000000001';
  select saldo into v_saldo_atual from vw_saldo_livro where livro_uid = '00000000-0011-0000-0000-000000000001';
  if v_baseline <> 10 or v_saldo_atual <> 10 then
    raise exception 'baseline/saldo final do produto A esperados 10/10, encontrado %/%', v_baseline, v_saldo_atual;
  end if;
end $$;

rollback;

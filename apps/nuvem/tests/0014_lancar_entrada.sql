-- Validacao manual da migracao 0014_lancar_entrada.sql.
--
-- Execute em homologacao, nunca em producao:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/nuvem/migrations/0014_lancar_entrada.sql
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/nuvem/tests/0014_lancar_entrada.sql
--
-- Prova: a entrada sobe o saldo oficial e e idempotente por (nota, livro).
-- Faz rollback no final.

\i apps/nuvem/migrations/0014_lancar_entrada.sql

begin;

insert into usuario (sync_uid, usuario, perfil)
values ('00000000-0014-0000-0000-0000000000ad', 'admin-teste-0014', 'admin');

insert into livro (sync_uid, codigo, titulo, preco_centavos, categoria, busca_norm, ativo, origem)
values ('00000000-0014-0000-0000-000000000001', 'TESTE-0014', 'Produto teste 0014', 1000, 0, 'produto teste 0014', true, 'escritorio');

-- Duas chamadas identicas: a segunda nao deve duplicar (idempotencia por sync_uid).
select lancar_entrada('admin-teste-0014', 'Fornecedor Teste', 'NOTA-0014',
  '[{"codigo":"TESTE-0014","qtd":5,"custo_unit_centavos":1000}]'::jsonb);
select lancar_entrada('admin-teste-0014', 'Fornecedor Teste', 'NOTA-0014',
  '[{"codigo":"TESTE-0014","qtd":5,"custo_unit_centavos":1000}]'::jsonb);

do $$
declare v_saldo bigint; n int;
begin
  select saldo into v_saldo from vw_saldo_livro where codigo = 'TESTE-0014';
  select count(*) into n from movimento_estoque where referencia = 'NOTA-0014' and tipo = 'entrada';
  if v_saldo <> 5 then
    raise exception 'entrada: saldo esperado 5, veio %', v_saldo;
  end if;
  if n <> 1 then
    raise exception 'entrada: idempotencia esperava 1 movimento, veio %', n;
  end if;
end $$;

-- Nao-admin deve ser recusado.
do $$
begin
  begin
    perform lancar_entrada('admin-teste-0014-nao', 'F', 'NOTA-X',
      '[{"codigo":"TESTE-0014","qtd":1}]'::jsonb);
    raise exception 'entrada: nao-admin deveria ter sido recusado';
  exception when others then
    null; -- esperado (sem permissao)
  end;
end $$;

rollback;

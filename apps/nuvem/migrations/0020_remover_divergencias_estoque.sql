-- Remove a fila de divergencias sem alterar a baixa oficial de estoque.
-- Pedidos com itens ainda desconhecidos permanecem em `pronta` e podem ser
-- incorporados quando o item chegar. Saldos negativos continuam representados
-- diretamente no razao de movimentos e na view oficial.

create or replace function incorporar_pedido(p_pedido uuid)
returns void
language plpgsql
as $$
declare
  item record;
  itens_invalidos bigint;
  v_criado_por uuid;
  v_numero bigint;
  v_origem text;
begin
  select criado_por, numero, origem
    into v_criado_por, v_numero, v_origem
    from pedido where sync_uid = p_pedido;

  select count(*) into itens_invalidos
  from item_pedido ip
  left join livro l
    on l.excluido_em is null
   and (l.sync_uid = ip.livro_uid or (ip.livro_uid is null and l.codigo = ip.codigo))
  where ip.pedido_uid = p_pedido
    and ip.excluido_em is null
    and l.sync_uid is null;

  if itens_invalidos > 0 then
    return;
  end if;

  if not exists (
    select 1 from item_pedido ip where ip.pedido_uid = p_pedido and ip.excluido_em is null
  ) then
    return;
  end if;

  for item in
    select
      ip.sync_uid as item_uid,
      abs(ip.qtd)::bigint as qtd_vendida,
      l.sync_uid as livro_uid
    from item_pedido ip
    join livro l
      on l.excluido_em is null
     and (l.sync_uid = ip.livro_uid or (ip.livro_uid is null and l.codigo = ip.codigo))
    where ip.pedido_uid = p_pedido
      and ip.excluido_em is null
  loop
    update item_pedido
       set livro_uid = item.livro_uid,
           atualizado_em = coalesce(atualizado_em, now())
     where sync_uid = item.item_uid
       and livro_uid is null;

    insert into movimento_estoque (
      sync_uid, livro_uid, tipo, qtd, motivo, referencia, criado_em, origem,
      atualizado_em, criado_por, pedido_uid, item_pedido_uid
    )
    values (
      gen_random_uuid(), item.livro_uid, 'saida_venda', -item.qtd_vendida,
      'Baixa automatica por venda pronta', v_numero::text, now()::text,
      coalesce(v_origem, 'pdv'), now(), v_criado_por, p_pedido, item.item_uid
    )
    on conflict do nothing;
  end loop;

  update pedido
     set estoque_status = 'incorporada',
         estoque_pronta_em = coalesce(estoque_pronta_em, now()),
         estoque_incorporada_em = coalesce(estoque_incorporada_em, now()),
         atualizado_em = now()
   where sync_uid = p_pedido
     and estoque_status = 'pronta';
end;
$$;

update pedido
   set estoque_status = 'pronta', atualizado_em = now()
 where estoque_status = 'divergente';

alter table pedido drop constraint if exists pedido_estoque_status_check;
alter table pedido add constraint pedido_estoque_status_check
  check (estoque_status in ('rascunho','pronta','incorporada','cancelada_estornada'));

drop table if exists divergencia_estoque;

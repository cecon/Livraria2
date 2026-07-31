-- Feature 011: incorporacao de venda tolerante a chegada tardia dos itens.
--
-- Problema: o sync empurra pais->filhas (ORDEM_DEPENDENCIA), entao o `pedido`
-- (estoque_status='pronta') chega na nuvem ANTES dos `item_pedido`. O trigger de
-- venda pronta disparava na hora, nao encontrava itens e marcava o pedido como
-- 'divergente' ("venda sem itens"), sem nunca reprocessar quando os itens
-- chegavam ~centenas de ms depois. Resultado: a baixa oficial nunca acontecia.
--
-- Correcao (100% nuvem, idempotente):
--   * incorporar_pedido(uid): funcao unica, idempotente, que cria as saidas
--     faltantes e marca 'incorporada' quando ha itens; se ainda nao ha itens,
--     NAO marca divergente -- apenas espera.
--   * trigger de pedido pronta -> delega para incorporar_pedido.
--   * NOVO trigger em item_pedido -> quando o item chega e o pedido esta
--     'pronta', chama incorporar_pedido. Isso fecha a corrida de ordem de sync.

-- 1) Nucleo idempotente da incorporacao.
create or replace function incorporar_pedido(p_pedido uuid)
returns void
language plpgsql
as $$
declare
  item record;
  itens_invalidos bigint;
  saldo_depois bigint;
  v_criado_por uuid;
  v_numero bigint;
  v_origem text;
begin
  select criado_por, numero, origem
    into v_criado_por, v_numero, v_origem
    from pedido where sync_uid = p_pedido;

  -- Itens que nao resolvem produto (por uid nem por codigo).
  select count(*) into itens_invalidos
  from item_pedido ip
  left join livro l
    on l.excluido_em is null
   and (l.sync_uid = ip.livro_uid or (ip.livro_uid is null and l.codigo = ip.codigo))
  where ip.pedido_uid = p_pedido
    and ip.excluido_em is null
    and l.sync_uid is null;

  if itens_invalidos > 0 then
    insert into divergencia_estoque (pedido_uid, tipo, descricao, qtd_evento, criado_por, atualizado_em)
    values (p_pedido, 'venda_invalida', 'Venda pronta com item sem produto conhecido na nuvem.', itens_invalidos, v_criado_por, now());
    update pedido set estoque_status = 'divergente', atualizado_em = now() where sync_uid = p_pedido;
    return;
  end if;

  -- Sem itens ainda: corrida de sync (itens chegam depois). Nao marca divergente;
  -- o trigger de item_pedido reprocessa quando eles chegarem.
  if not exists (
    select 1 from item_pedido ip where ip.pedido_uid = p_pedido and ip.excluido_em is null
  ) then
    return;
  end if;

  for item in
    select
      ip.sync_uid as item_uid,
      ip.codigo,
      abs(ip.qtd)::bigint as qtd_vendida,
      l.sync_uid as livro_uid,
      l.ativo,
      coalesce(s.saldo, 0)::bigint as saldo_antes
    from item_pedido ip
    join livro l
      on l.excluido_em is null
     and (l.sync_uid = ip.livro_uid or (ip.livro_uid is null and l.codigo = ip.codigo))
    left join vw_saldo_livro s on s.livro_uid = l.sync_uid
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

    saldo_depois := item.saldo_antes - item.qtd_vendida;

    if item.ativo = false then
      insert into divergencia_estoque (
        pedido_uid, item_pedido_uid, livro_uid, tipo, descricao, saldo_antes,
        qtd_evento, criado_por, atualizado_em
      )
      values (
        p_pedido, item.item_uid, item.livro_uid, 'produto_inativo',
        'Venda pronta referenciou produto inativo.', item.saldo_antes,
        item.qtd_vendida, v_criado_por, now()
      );
    end if;

    if saldo_depois < 0 then
      insert into divergencia_estoque (
        pedido_uid, item_pedido_uid, livro_uid, tipo, descricao, saldo_antes,
        qtd_evento, criado_por, atualizado_em
      )
      values (
        p_pedido, item.item_uid, item.livro_uid, 'saldo_negativo',
        'Baixa de venda pronta deixou saldo oficial negativo.', item.saldo_antes,
        item.qtd_vendida, v_criado_por, now()
      );
    end if;
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

-- 2) Trigger de pedido pronta agora apenas delega (sem "sem itens -> divergente").
create or replace function processar_estoque_venda_pronta()
returns trigger
language plpgsql
as $$
begin
  if new.estoque_status <> 'pronta' or new.cancelado then
    return new;
  end if;
  perform incorporar_pedido(new.sync_uid);
  return new;
end;
$$;

-- 3) NOVO: quando o item chega (depois do pedido), incorpora se o pedido esta pronta.
create or replace function processar_item_incorpora()
returns trigger
language plpgsql
as $$
declare
  v_status text;
  v_cancelado boolean;
begin
  select estoque_status, cancelado
    into v_status, v_cancelado
    from pedido where sync_uid = new.pedido_uid;

  if v_status = 'pronta' and coalesce(v_cancelado, false) = false then
    perform incorporar_pedido(new.pedido_uid);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_item_incorpora on item_pedido;
create trigger trg_item_incorpora
  after insert on item_pedido
  for each row
  execute function processar_item_incorpora();

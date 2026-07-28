-- Feature 011: estoque oficial na nuvem por venda pronta.
-- Idempotente e preserva o saldo atual de producao como baseline auditavel.

create extension if not exists pgcrypto;

alter table pedido
  add column if not exists estoque_status text not null default 'rascunho',
  add column if not exists estoque_pronta_em timestamptz,
  add column if not exists estoque_incorporada_em timestamptz,
  add column if not exists estoque_estornada_em timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pedido_estoque_status_check'
  ) then
    alter table pedido add constraint pedido_estoque_status_check
      check (estoque_status in ('rascunho','pronta','incorporada','cancelada_estornada','divergente'));
  end if;
end $$;

alter table item_pedido
  add column if not exists livro_uid uuid references livro(sync_uid);

alter table movimento_estoque
  add column if not exists pedido_uid uuid references pedido(sync_uid),
  add column if not exists item_pedido_uid uuid references item_pedido(sync_uid),
  add column if not exists movimento_origem_uid uuid references movimento_estoque(sync_uid);

create table if not exists divergencia_estoque (
  sync_uid uuid primary key default gen_random_uuid(),
  pedido_uid uuid references pedido(sync_uid),
  item_pedido_uid uuid references item_pedido(sync_uid),
  livro_uid uuid references livro(sync_uid),
  tipo text not null check (tipo in ('saldo_negativo','produto_inativo','venda_invalida','processamento_estoque')),
  descricao text not null default '',
  saldo_antes bigint,
  qtd_evento bigint,
  status text not null default 'aberta' check (status in ('aberta','resolvida','ignorada')),
  criado_em timestamptz not null default now(),
  resolvida_em timestamptz,
  resolvida_por uuid references usuario(sync_uid),
  origem text not null default 'escritorio' check (origem in ('pdv','escritorio')),
  atualizado_em timestamptz,
  excluido_em timestamptz,
  criado_por uuid,
  sincronizado_em timestamptz not null default now()
);

create table if not exists saldo_partida_producao (
  sync_uid uuid primary key default gen_random_uuid(),
  livro_uid uuid not null references livro(sync_uid),
  saldo bigint not null,
  capturado_em timestamptz not null default now(),
  origem text not null default 'producao'
);

create unique index if not exists idx_saldo_partida_producao_livro
  on saldo_partida_producao(livro_uid);

create unique index if not exists idx_mov_saida_venda_item
  on movimento_estoque(item_pedido_uid)
  where tipo = 'saida_venda' and item_pedido_uid is not null and excluido_em is null;

create unique index if not exists idx_mov_estorno_origem
  on movimento_estoque(movimento_origem_uid)
  where tipo = 'estorno_venda' and movimento_origem_uid is not null and excluido_em is null;

create index if not exists idx_divergencia_estoque_status
  on divergencia_estoque(status, criado_em);

alter table divergencia_estoque enable row level security;
drop policy if exists divergencia_estoque_auth_all on divergencia_estoque;
create policy divergencia_estoque_auth_all on divergencia_estoque
  to authenticated using (true) with check (true);

alter table saldo_partida_producao enable row level security;
drop policy if exists saldo_partida_producao_auth_all on saldo_partida_producao;
create policy saldo_partida_producao_auth_all on saldo_partida_producao
  to authenticated using (true) with check (true);

create or replace view vw_produto_pdv as
select
  l.sync_uid as livro_uid,
  l.codigo,
  l.titulo,
  l.autor,
  l.preco_centavos,
  l.categoria,
  l.descricao,
  l.busca_norm,
  l.ativo,
  coalesce(s.saldo, 0)::bigint as saldo_publicado,
  l.sincronizado_em
from livro l
left join vw_saldo_livro s on s.livro_uid = l.sync_uid
where l.excluido_em is null and l.ativo = true;

create or replace function capturar_saldo_partida_producao()
returns void
language plpgsql
as $$
begin
  insert into saldo_partida_producao (sync_uid, livro_uid, saldo, capturado_em)
  select gen_random_uuid(), l.sync_uid, coalesce(s.saldo, 0)::bigint, now()
  from livro l
  left join vw_saldo_livro s on s.livro_uid = l.sync_uid
  where l.excluido_em is null
  on conflict (livro_uid) do nothing;
end;
$$;

create or replace function processar_estoque_venda_pronta()
returns trigger
language plpgsql
as $$
declare
  item record;
  itens_invalidos bigint;
  saldo_depois bigint;
begin
  if new.estoque_status <> 'pronta' or new.cancelado then
    return new;
  end if;

  select count(*) into itens_invalidos
  from item_pedido ip
  left join livro l
    on l.excluido_em is null
   and (l.sync_uid = ip.livro_uid or (ip.livro_uid is null and l.codigo = ip.codigo))
  where ip.pedido_uid = new.sync_uid
    and ip.excluido_em is null
    and l.sync_uid is null;

  if itens_invalidos > 0 then
    insert into divergencia_estoque (pedido_uid, tipo, descricao, qtd_evento, criado_por, atualizado_em)
    values (new.sync_uid, 'venda_invalida', 'Venda pronta com item sem produto conhecido na nuvem.', itens_invalidos, new.criado_por, now());

    update pedido
       set estoque_status = 'divergente',
           atualizado_em = now()
     where sync_uid = new.sync_uid;
    return new;
  end if;

  if not exists (
    select 1 from item_pedido ip where ip.pedido_uid = new.sync_uid and ip.excluido_em is null
  ) then
    insert into divergencia_estoque (pedido_uid, tipo, descricao, criado_por, atualizado_em)
    values (new.sync_uid, 'venda_invalida', 'Venda pronta sem itens.', new.criado_por, now());

    update pedido
       set estoque_status = 'divergente',
           atualizado_em = now()
     where sync_uid = new.sync_uid;
    return new;
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
    where ip.pedido_uid = new.sync_uid
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
      'Baixa automatica por venda pronta', new.numero::text, now()::text,
      coalesce(new.origem, 'pdv'), now(), new.criado_por, new.sync_uid, item.item_uid
    )
    on conflict do nothing;

    saldo_depois := item.saldo_antes - item.qtd_vendida;

    if item.ativo = false then
      insert into divergencia_estoque (
        pedido_uid, item_pedido_uid, livro_uid, tipo, descricao, saldo_antes,
        qtd_evento, criado_por, atualizado_em
      )
      values (
        new.sync_uid, item.item_uid, item.livro_uid, 'produto_inativo',
        'Venda pronta referenciou produto inativo.', item.saldo_antes,
        item.qtd_vendida, new.criado_por, now()
      );
    end if;

    if saldo_depois < 0 then
      insert into divergencia_estoque (
        pedido_uid, item_pedido_uid, livro_uid, tipo, descricao, saldo_antes,
        qtd_evento, criado_por, atualizado_em
      )
      values (
        new.sync_uid, item.item_uid, item.livro_uid, 'saldo_negativo',
        'Baixa de venda pronta deixou saldo oficial negativo.', item.saldo_antes,
        item.qtd_vendida, new.criado_por, now()
      );
    end if;
  end loop;

  update pedido
     set estoque_status = 'incorporada',
         estoque_pronta_em = coalesce(estoque_pronta_em, now()),
         estoque_incorporada_em = coalesce(estoque_incorporada_em, now()),
         atualizado_em = now()
   where sync_uid = new.sync_uid
     and estoque_status = 'pronta';

  return new;
end;
$$;

create or replace function processar_estorno_venda_cancelada()
returns trigger
language plpgsql
as $$
declare
  mov record;
begin
  if new.cancelado is not true then
    return new;
  end if;

  for mov in
    select m.*
    from movimento_estoque m
    where m.pedido_uid = new.sync_uid
      and m.tipo = 'saida_venda'
      and m.excluido_em is null
      and not exists (
        select 1
        from movimento_estoque e
        where e.movimento_origem_uid = m.sync_uid
          and e.tipo = 'estorno_venda'
          and e.excluido_em is null
      )
  loop
    insert into movimento_estoque (
      sync_uid, livro_uid, tipo, qtd, motivo, referencia, criado_em, origem,
      atualizado_em, criado_por, pedido_uid, item_pedido_uid, movimento_origem_uid
    )
    values (
      gen_random_uuid(), mov.livro_uid, 'estorno_venda', abs(mov.qtd),
      'Estorno automatico por cancelamento de venda', new.numero::text, now()::text,
      coalesce(new.origem, 'pdv'), now(), new.criado_por, new.sync_uid,
      mov.item_pedido_uid, mov.sync_uid
    )
    on conflict do nothing;
  end loop;

  update pedido
     set estoque_status = 'cancelada_estornada',
         estoque_estornada_em = coalesce(estoque_estornada_em, now()),
         atualizado_em = now()
   where sync_uid = new.sync_uid
     and estoque_status in ('incorporada','pronta');

  return new;
end;
$$;

drop trigger if exists trg_pedido_estoque_pronta on pedido;
create trigger trg_pedido_estoque_pronta
after insert or update of estoque_status on pedido
for each row
when (new.estoque_status = 'pronta' and new.cancelado = false)
execute function processar_estoque_venda_pronta();

drop trigger if exists trg_pedido_estoque_cancelamento on pedido;
create trigger trg_pedido_estoque_cancelamento
after update of cancelado, cancelado_em on pedido
for each row
when (new.cancelado = true)
execute function processar_estorno_venda_cancelada();

select capturar_saldo_partida_producao();

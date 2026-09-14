-- Experimental API schema: apply explicitly, never through the legacy migrator.
begin;
create table if not exists public.nuvem_sync_contador (
  id integer primary key check (id = 1),
  sequencia bigint not null default 0
);
insert into public.nuvem_sync_contador(id) values (1) on conflict do nothing;

create table if not exists public.nuvem_pdv (
  uid uuid primary key,
  nome text not null,
  usuario_uid uuid not null references public.usuario(sync_uid),
  ativo boolean not null default true,
  versao_token integer not null default 1,
  refresh_hash text,
  refresh_expira_em timestamptz,
  cursor_aplicado bigint not null default 0,
  cursor_entregue bigint not null default 0,
  confirmado_em timestamptz,
  check (cursor_aplicado >= 0 and cursor_entregue >= cursor_aplicado)
);

alter table public.nuvem_pdv add column if not exists refresh_hash text;
alter table public.nuvem_pdv add column if not exists refresh_expira_em timestamptz;

create table if not exists public.nuvem_catalogo_evento (
  sequencia bigint primary key,
  produto_uid uuid not null,
  operacao text not null check (operacao in ('upsert', 'delete')),
  produto jsonb,
  criado_em timestamptz not null default now()
);

-- Serialize before acquiring product row locks. Counter increments roll back with
-- the write; committed sequence order cannot overtake an uncommitted publisher.
create or replace function public.nuvem_catalogo_lock()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  perform 1 from public.nuvem_sync_contador where id = 1 for update;
  return null;
end $$;

create or replace function public.nuvem_catalogo_publicar()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare n bigint; p jsonb; u uuid; op text;
begin
  if TG_OP = 'DELETE' then
    u := OLD.sync_uid; op := 'delete';
  else
    u := NEW.sync_uid;
    op := case when not NEW.ativo or NEW.excluido_em is not null then 'delete' else 'upsert' end;
    if op = 'upsert' then
      if NEW.preco_centavos < 0 or NEW.preco_centavos > 9007199254740991 then
        raise exception 'Preco fora do contrato em centavos';
      end if;
      p := jsonb_build_object(
        'codigo', NEW.codigo, 'titulo', NEW.titulo, 'autor', NEW.autor,
        'precoCentavos', NEW.preco_centavos, 'ativo', NEW.ativo,
        'categoria', NEW.categoria, 'descricao', NEW.descricao,
        'buscaNorm', NEW.busca_norm);
    end if;
  end if;
  update public.nuvem_sync_contador set sequencia = sequencia + 1
    where id = 1 returning sequencia into n;
  insert into public.nuvem_catalogo_evento(sequencia, produto_uid, operacao, produto)
    values (n, u, op, p);
  return null;
end $$;

create or replace function public.nuvem_catalogo_identidade()
returns trigger language plpgsql as $$
begin
  if NEW.sync_uid is distinct from OLD.sync_uid then
    raise exception 'UUID do produto e imutavel';
  end if;
  return NEW;
end $$;
drop trigger if exists nuvem_catalogo_identidade on public.livro;
create trigger nuvem_catalogo_identidade before update on public.livro
  for each row execute function public.nuvem_catalogo_identidade();

drop trigger if exists nuvem_catalogo_lock on public.livro;
create trigger nuvem_catalogo_lock before insert or update or delete on public.livro
  for each statement execute function public.nuvem_catalogo_lock();
drop trigger if exists nuvem_catalogo_publicar on public.livro;
create trigger nuvem_catalogo_publicar after insert or update or delete on public.livro
  for each row execute function public.nuvem_catalogo_publicar();

-- Initial snapshot only on first installation, while the publisher lock is held.
do $$
declare l record; n bigint;
begin
  perform 1 from public.nuvem_sync_contador where id = 1 for update;
  if not exists(select 1 from public.nuvem_catalogo_evento) then
    if exists(select 1 from public.livro where ativo and excluido_em is null
      and (preco_centavos < 0 or preco_centavos > 9007199254740991)) then
      raise exception 'Catalogo inicial possui preco fora do contrato';
    end if;
    for l in select * from public.livro order by sync_uid loop
      update public.nuvem_sync_contador set sequencia = sequencia + 1
        where id = 1 returning sequencia into n;
      insert into public.nuvem_catalogo_evento(sequencia, produto_uid, operacao, produto)
      values(n, l.sync_uid,
        case when l.ativo and l.excluido_em is null then 'upsert' else 'delete' end,
        case when l.ativo and l.excluido_em is null then jsonb_build_object(
          'codigo', l.codigo, 'titulo', l.titulo, 'autor', l.autor,
          'precoCentavos', l.preco_centavos, 'ativo', l.ativo,
          'categoria', l.categoria, 'descricao', l.descricao, 'buscaNorm', l.busca_norm)
        else null end);
    end loop;
  end if;
end $$;

alter table public.nuvem_sync_contador enable row level security;
alter table public.nuvem_pdv enable row level security;
alter table public.nuvem_catalogo_evento enable row level security;
revoke all on public.nuvem_sync_contador, public.nuvem_pdv,
  public.nuvem_catalogo_evento from public;
commit;

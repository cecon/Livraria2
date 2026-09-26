begin;
create table if not exists public.nuvem_produto_operacao (
  uid uuid primary key,
  responsavel_uid uuid not null references public.usuario(sync_uid),
  pedido jsonb not null,
  resultado jsonb not null,
  criado_em timestamptz not null default now()
);
alter table public.nuvem_produto_operacao enable row level security;
revoke all on public.nuvem_produto_operacao from public;
do $$ begin
  if exists(select 1 from pg_roles where rolname='authenticated') then
    revoke all on public.nuvem_produto_operacao from authenticated;
  end if;
  if exists(select 1 from pg_roles where rolname='anon') then
    revoke all on public.nuvem_produto_operacao from anon;
  end if;
end $$;
commit;

begin;
create table if not exists public.nuvem_venda_recibo (
  pedido_uid uuid primary key references public.pedido(sync_uid),
  pdv_uid uuid not null references public.nuvem_pdv(uid),
  hash text not null,
  resultado jsonb not null,
  cancelamento jsonb,
  criado_em timestamptz not null default now()
);
alter table public.nuvem_venda_recibo enable row level security;
revoke all on public.nuvem_venda_recibo from public;
commit;

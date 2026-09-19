begin;
create table if not exists public.caixa_movimento (
  sync_uid uuid primary key,
  turno_uid uuid not null references public.turno_operacao(sync_uid),
  operador_uid uuid not null references public.usuario(sync_uid),
  tipo text not null check (tipo in ('sangria', 'suprimento')),
  valor_centavos bigint not null check (valor_centavos > 0),
  motivo text not null check (length(trim(motivo)) > 0),
  criado_em text not null,
  recebido_em timestamptz not null default now()
);
create index if not exists idx_caixa_movimento_turno on public.caixa_movimento(turno_uid, criado_em);
alter table public.caixa_movimento enable row level security;
revoke all on public.caixa_movimento from public;
commit;

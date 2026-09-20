begin;
create table if not exists public.llm_configuracao (
  uid uuid primary key,
  nome text not null check(length(nome) between 1 and 100),
  provedor text not null check(provedor in ('openai-compatible','google')),
  endereco text not null,
  modelo text not null,
  credencial text,
  ativo boolean not null default true,
  pdv boolean not null default false,
  retaguarda boolean not null default true,
  versao integer not null default 1,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid not null references public.usuario(sync_uid)
);
create table if not exists public.llm_auditoria (
  uid uuid primary key,
  configuracao_uid uuid not null references public.llm_configuracao(uid),
  usuario_uid uuid not null references public.usuario(sync_uid),
  pdv_uid uuid,
  turno_uid uuid,
  acao text not null,
  resultado text not null,
  criado_em timestamptz not null default now()
);
alter table public.llm_configuracao enable row level security;
alter table public.llm_auditoria enable row level security;
revoke all on public.llm_configuracao, public.llm_auditoria from public;
do $$ begin
  if exists(select 1 from pg_roles where rolname='authenticated') then
    revoke all on public.llm_configuracao, public.llm_auditoria from authenticated;
  end if;
  if exists(select 1 from pg_roles where rolname='anon') then
    revoke all on public.llm_configuracao, public.llm_auditoria from anon;
  end if;
end $$;
commit;

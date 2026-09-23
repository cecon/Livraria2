-- IA externa / MCP OAuth: sessoes temporarias, tokens e clientes OAuth publicados.

create table if not exists public.ia_solicitacao (
  uid uuid primary key,
  cliente text not null,
  finalidade text not null,
  expira_em timestamptz not null,
  autorizado_em timestamptz,
  criado_em timestamptz not null default now()
);

create table if not exists public.ia_acesso (
  uid uuid primary key,
  solicitacao_uid uuid not null references public.ia_solicitacao(uid) on delete cascade,
  usuario_uid uuid not null references public.usuario(sync_uid),
  token_hash text not null unique,
  modo text not null check (modo in ('consulta','alteracao')),
  expira_em timestamptz not null,
  criado_em timestamptz not null default now(),
  revogado_em timestamptz,
  ultimo_uso_em timestamptz,
  oauth_client_id text,
  oauth_resource text,
  oauth_scope text
);

create table if not exists public.ia_requisicao (
  uid uuid primary key,
  acesso_uid uuid not null references public.ia_acesso(uid) on delete cascade,
  usuario_uid uuid not null references public.usuario(sync_uid),
  metodo text not null,
  rota text not null,
  status integer,
  criado_em timestamptz not null default now(),
  concluido_em timestamptz
);

create table if not exists public.ia_oauth_client (
  client_id text primary key,
  client_name text not null,
  redirect_uris jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.ia_oauth_code (
  uid uuid primary key,
  code_hash text not null unique,
  client_id text not null,
  redirect_uri text not null,
  code_challenge text not null,
  resource text not null,
  scope text not null,
  usuario_uid uuid not null references public.usuario(sync_uid),
  modo text not null check (modo in ('consulta','alteracao')),
  expira_em timestamptz not null,
  criado_em timestamptz not null default now(),
  usado_em timestamptz
);

create index if not exists idx_ia_acesso_usuario on public.ia_acesso(usuario_uid, criado_em desc);
create index if not exists idx_ia_acesso_token on public.ia_acesso(token_hash) where revogado_em is null;
create index if not exists idx_ia_oauth_code_hash on public.ia_oauth_code(code_hash) where usado_em is null;
create index if not exists idx_ia_requisicao_acesso on public.ia_requisicao(acesso_uid, criado_em desc);
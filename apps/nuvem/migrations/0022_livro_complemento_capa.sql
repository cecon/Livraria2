-- Complementos usados pelo assistente de cadastro, capas internas e análise de qualidade.
create table if not exists public.livro_complemento (
  livro_uid uuid primary key references public.livro(sync_uid) on delete cascade,
  editora text not null default '',
  isbn text not null default '',
  custo_centavos bigint,
  capa_url text not null default '',
  fontes jsonb not null default '[]'::jsonb,
  versao integer not null default 0,
  nota integer,
  pendencias jsonb not null default '[]'::jsonb,
  analise_hash text,
  analisado_em timestamptz,
  analisado_por uuid,
  criterio_versao integer not null default 0,
  atualizado_em timestamptz not null default now()
);

create table if not exists public.livro_capa_arquivo (
  uid uuid primary key,
  conteudo bytea not null,
  criado_por uuid,
  criado_em timestamptz not null default now()
);

create index if not exists idx_livro_complemento_nota on public.livro_complemento(nota);

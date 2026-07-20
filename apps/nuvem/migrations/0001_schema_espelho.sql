-- Feature 007 — schema espelho na nuvem (T008). Relações por sync_uid (não por id local).
-- Derivados (estoque, custo_medio) ficam em VIEWS; usuario SEM senha_hash (D15).
-- Colunas de sync comuns: origem, atualizado_em, excluido_em, criado_por, sincronizado_em.

create extension if not exists pgcrypto;

-- ===== Cadastros (pais) =====
create table if not exists livro (
  sync_uid uuid primary key,
  codigo text not null unique,
  titulo text not null,
  autor text,
  preco_centavos bigint not null default 0 check (preco_centavos >= 0),
  categoria int not null default 0,
  descricao text,
  busca_norm text not null default '',
  ativo boolean not null default true,
  origem text not null default 'pdv' check (origem in ('pdv','escritorio')),
  atualizado_em timestamptz,
  excluido_em timestamptz,
  criado_por uuid,
  sincronizado_em timestamptz not null default now()
);

create table if not exists fornecedor (
  sync_uid uuid primary key,
  nome text not null,
  nome_norm text not null unique,
  documento text,
  telefone text,
  email text,
  observacoes text,
  ativo boolean not null default true,
  origem text not null default 'pdv' check (origem in ('pdv','escritorio')),
  atualizado_em timestamptz,
  excluido_em timestamptz,
  criado_por uuid,
  sincronizado_em timestamptz not null default now()
);

-- operador do PDV: só identidade, NUNCA senha_hash (D15)
create table if not exists usuario (
  sync_uid uuid primary key,
  usuario text not null unique,
  nome text,
  ativo boolean not null default true,
  origem text not null default 'pdv' check (origem in ('pdv','escritorio')),
  atualizado_em timestamptz,
  excluido_em timestamptz,
  criado_por uuid,
  sincronizado_em timestamptz not null default now()
);

create table if not exists forma_pagamento (
  sync_uid uuid primary key,
  chave text not null unique,
  rotulo text not null,
  de_sistema boolean not null default false,
  ativa boolean not null default true,
  ordem int not null default 0,
  origem text not null default 'pdv' check (origem in ('pdv','escritorio')),
  atualizado_em timestamptz,
  excluido_em timestamptz,
  criado_por uuid,
  sincronizado_em timestamptz not null default now()
);

create table if not exists destinacao (
  sync_uid uuid primary key,
  nome text not null,
  nome_norm text not null,
  de_sistema boolean not null default false,
  ativa boolean not null default true,
  ordem int not null default 0,
  origem text not null default 'pdv' check (origem in ('pdv','escritorio')),
  atualizado_em timestamptz,
  excluido_em timestamptz,
  criado_por uuid,
  sincronizado_em timestamptz not null default now()
);

-- ===== Vendas (PDV) =====
create table if not exists pedido (
  sync_uid uuid primary key,
  numero bigint not null,
  cliente text not null default 'CLIENTE',
  turno text not null,
  data text not null,
  total_centavos bigint not null check (total_centavos >= 0),
  cancelado boolean not null default false,
  cancelado_em timestamptz,
  operador_uid uuid references usuario(sync_uid),
  origem text not null default 'pdv' check (origem in ('pdv','escritorio')),
  atualizado_em timestamptz,
  excluido_em timestamptz,
  criado_por uuid,
  sincronizado_em timestamptz not null default now()
);

create table if not exists item_pedido (
  sync_uid uuid primary key,
  pedido_uid uuid not null references pedido(sync_uid),
  codigo text not null,
  titulo text not null,
  preco_centavos bigint not null check (preco_centavos >= 0),
  qtd bigint not null check (qtd <> 0),
  origem text not null default 'pdv' check (origem in ('pdv','escritorio')),
  atualizado_em timestamptz,
  excluido_em timestamptz,
  criado_por uuid,
  sincronizado_em timestamptz not null default now()
);

create table if not exists pagamento_pedido (
  sync_uid uuid primary key,
  pedido_uid uuid not null references pedido(sync_uid),
  forma_uid uuid not null references forma_pagamento(sync_uid),
  valor_centavos bigint not null check (valor_centavos >= 0),
  origem text not null default 'pdv' check (origem in ('pdv','escritorio')),
  atualizado_em timestamptz,
  excluido_em timestamptz,
  criado_por uuid,
  sincronizado_em timestamptz not null default now(),
  unique (pedido_uid, forma_uid)
);

-- ===== Estoque (eventos append-only) =====
create table if not exists movimento_estoque (
  sync_uid uuid primary key,
  livro_uid uuid not null references livro(sync_uid),
  tipo text not null,
  qtd bigint not null check (qtd <> 0),
  custo_unit_centavos bigint,
  fornecedor text,
  motivo text,
  referencia text,
  criado_em text not null default '',
  origem text not null default 'pdv' check (origem in ('pdv','escritorio')),
  atualizado_em timestamptz,
  excluido_em timestamptz,
  criado_por uuid,
  sincronizado_em timestamptz not null default now()
);

-- ===== Recebimento (escritório) =====
create table if not exists lancamento_entrada (
  sync_uid uuid primary key,
  fornecedor_uid uuid references fornecedor(sync_uid),
  numero text,
  data text not null default '',
  status text not null default 'rascunho',
  finalizada_em text,
  origem text not null default 'pdv' check (origem in ('pdv','escritorio')),
  atualizado_em timestamptz,
  excluido_em timestamptz,
  criado_por uuid,
  sincronizado_em timestamptz not null default now()
);

create table if not exists item_lancamento (
  sync_uid uuid primary key,
  lancamento_uid uuid not null references lancamento_entrada(sync_uid),
  livro_uid uuid not null references livro(sync_uid),
  qtd bigint not null check (qtd <> 0),
  custo_unit_centavos bigint not null default 0 check (custo_unit_centavos >= 0),
  origem text not null default 'pdv' check (origem in ('pdv','escritorio')),
  atualizado_em timestamptz,
  excluido_em timestamptz,
  criado_por uuid,
  sincronizado_em timestamptz not null default now()
);

-- ===== Destinação de doações (006) =====
create table if not exists transferencia_destinacao (
  sync_uid uuid primary key,
  livro_uid uuid not null references livro(sync_uid),
  de_destinacao_uid uuid references destinacao(sync_uid),
  para_destinacao_uid uuid references destinacao(sync_uid),
  qtd bigint not null,
  motivo text,
  criado_em text not null default '',
  origem text not null default 'pdv' check (origem in ('pdv','escritorio')),
  atualizado_em timestamptz,
  excluido_em timestamptz,
  criado_por uuid,
  sincronizado_em timestamptz not null default now()
);

create table if not exists alocacao_venda (
  sync_uid uuid primary key,
  pedido_uid uuid not null references pedido(sync_uid),
  item_uid uuid not null references item_pedido(sync_uid),
  destinacao_uid uuid not null references destinacao(sync_uid),
  qtd bigint not null,
  valor_centavos bigint not null,
  origem text not null default 'pdv' check (origem in ('pdv','escritorio')),
  atualizado_em timestamptz,
  excluido_em timestamptz,
  criado_por uuid,
  sincronizado_em timestamptz not null default now()
);

-- ===== Cursor de pull (pego pelo tempo do servidor) =====
create index if not exists idx_livro_sinc on livro(sincronizado_em);
create index if not exists idx_fornecedor_sinc on fornecedor(sincronizado_em);
create index if not exists idx_usuario_sinc on usuario(sincronizado_em);
create index if not exists idx_forma_pagamento_sinc on forma_pagamento(sincronizado_em);
create index if not exists idx_destinacao_sinc on destinacao(sincronizado_em);
create index if not exists idx_pedido_sinc on pedido(sincronizado_em);
create index if not exists idx_item_pedido_sinc on item_pedido(sincronizado_em);
create index if not exists idx_pagamento_pedido_sinc on pagamento_pedido(sincronizado_em);
create index if not exists idx_movimento_estoque_sinc on movimento_estoque(sincronizado_em);
create index if not exists idx_lancamento_entrada_sinc on lancamento_entrada(sincronizado_em);
create index if not exists idx_item_lancamento_sinc on item_lancamento(sincronizado_em);
create index if not exists idx_transferencia_destinacao_sinc on transferencia_destinacao(sincronizado_em);
create index if not exists idx_alocacao_venda_sinc on alocacao_venda(sincronizado_em);

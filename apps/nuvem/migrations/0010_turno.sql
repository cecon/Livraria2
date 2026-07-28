-- Feature 009 (ADR-0021): turno de operação na nuvem. Mirror da réplica local
-- (m009), chaveado por sync_uid, com as colunas de sync comuns. Idempotente.
-- 0004/0005 (#15) e 0006–0009 (feature 010, gestão de usuários) já foram usadas — este é 0010.

create table if not exists turno_operacao (
  sync_uid uuid primary key,
  operador_uid uuid references usuario(sync_uid),
  caixa_inicial_centavos bigint not null default 0 check (caixa_inicial_centavos >= 0),
  status text not null default 'aberto' check (status in ('aberto','encerrado')),
  abertura text not null,
  encerramento text,
  esperado_centavos bigint,
  conferido_centavos bigint,
  diferenca_centavos bigint,
  origem text not null default 'pdv' check (origem in ('pdv','escritorio')),
  atualizado_em timestamptz,
  excluido_em timestamptz,
  criado_por uuid,
  sincronizado_em timestamptz not null default now()
);

create index if not exists idx_turno_operacao_sinc on turno_operacao (sincronizado_em);

-- Vínculo da venda ao turno + numeração por turno (FR-003). Nulos tolerados
-- para pedidos legados; o turno só é exigido em novas vendas.
alter table pedido add column if not exists turno_uid uuid references turno_operacao(sync_uid);
alter table pedido add column if not exists numero_no_turno bigint;

-- RLS: mesma política das demais tabelas (acesso a `authenticated`, ver 0002).
alter table turno_operacao enable row level security;
drop policy if exists turno_operacao_auth_all on turno_operacao;
create policy turno_operacao_auth_all on turno_operacao
  to authenticated using (true) with check (true);

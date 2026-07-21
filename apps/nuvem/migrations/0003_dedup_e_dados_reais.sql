-- Feature 007 — ajustes descobertos ao seedar a base de PRODUÇÃO real (aplicados na nuvem).
--
-- 1) Dedup de destinação por nome_norm: o upsert dos cadastros resolve conflito pela
--    CHAVE NATURAL (livro=codigo, fornecedor=nome_norm, usuario=usuario, forma_pagamento=chave,
--    destinacao=nome_norm) — porque o MESMO registro pode ter sync_uid diferente entre PDV e
--    nuvem. As demais já tinham UNIQUE; faltava a destinacao:
create unique index if not exists destinacao_nome_norm_key on destinacao (nome_norm);

-- 2) Remover os CHECKs de valor: o espelho recebe DADOS HISTÓRICOS reais que não respeitam
--    invariantes atuais (ex.: movimento com qtd=0). O invariante é do domínio (PDV), não do
--    espelho — o cloud deve aceitar o que já existe. Remove qtd<>0, *_centavos>=0, origem IN(...).
do $$
declare r record;
begin
  for r in
    select conrelid::regclass::text t, conname c
    from pg_constraint
    where contype = 'c' and connamespace = 'public'::regnamespace
  loop
    execute format('alter table %s drop constraint if exists %I', r.t, r.c);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array['livro','fornecedor','usuario','forma_pagamento','destinacao','pedido','item_pedido','pagamento_pedido','movimento_estoque','lancamento_entrada','item_lancamento','transferencia_destinacao','alocacao_venda']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t||'_auth_all', t);
    execute format('create policy %I on %I to authenticated using (true) with check (true)', t||'_auth_all', t);
  end loop;
end $$;

create or replace view vw_saldo_livro as
select l.sync_uid as livro_uid, l.codigo, coalesce(sum(m.qtd),0)::bigint as saldo
from livro l
left join movimento_estoque m on m.livro_uid = l.sync_uid and m.excluido_em is null
where l.excluido_em is null
group by l.sync_uid, l.codigo;

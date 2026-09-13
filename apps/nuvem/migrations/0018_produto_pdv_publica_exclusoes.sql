-- Publica tambem tombstones de livros excluidos/inativos para o PDV.
-- Sem isso, um produto removido na nuvem poderia ficar vendavel no SQLite local.
create or replace view public.vw_produto_pdv as
select
  l.sync_uid as livro_uid,
  l.codigo,
  l.titulo,
  l.autor,
  l.preco_centavos,
  l.categoria,
  l.descricao,
  l.busca_norm,
  l.ativo,
  coalesce(s.saldo, 0)::bigint as saldo_publicado,
  l.sincronizado_em,
  l.origem,
  l.atualizado_em,
  l.excluido_em
from public.livro l
left join public.vw_saldo_livro s on s.livro_uid = l.sync_uid;

update public.livro
   set sincronizado_em = now()
 where codigo in ('503', '9786585995887');

-- Publica atualizado_em na view consumida pelo PDV.
-- O pull local usa esse campo no LWW; sem ele, livro ja existente nao atualiza preco.
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
  l.atualizado_em
from public.livro l
left join public.vw_saldo_livro s on s.livro_uid = l.sync_uid
where l.excluido_em is null and l.ativo = true;

update public.livro
   set sincronizado_em = now()
 where excluido_em is null
   and ativo = true;

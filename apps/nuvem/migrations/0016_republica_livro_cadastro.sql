-- Garante que alteracoes de cadastro/preco/exclusao de livros fiquem visiveis
-- para o pull incremental do PDV, que usa livro.sincronizado_em como cursor.
create or replace function public.publica_livro_cadastro()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.sincronizado_em := coalesce(new.sincronizado_em, now());
    return new;
  end if;

  if row(
    new.codigo,
    new.titulo,
    new.autor,
    new.preco_centavos,
    new.categoria,
    new.descricao,
    new.ativo,
    new.excluido_em
  ) is distinct from row(
    old.codigo,
    old.titulo,
    old.autor,
    old.preco_centavos,
    old.categoria,
    old.descricao,
    old.ativo,
    old.excluido_em
  ) then
    new.sincronizado_em := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_livro_publica_cadastro on public.livro;

create trigger trg_livro_publica_cadastro
  before insert or update of codigo, titulo, autor, preco_centavos, categoria, descricao, ativo, excluido_em
  on public.livro
  for each row
  execute function public.publica_livro_cadastro();

update public.livro
   set sincronizado_em = now()
 where atualizado_em is not null
   and atualizado_em > sincronizado_em;

-- Feature 011: republicacao do saldo oficial para o PDV.
-- Fecha o loop do estoque oficial (ADR-0023): quando o estoque oficial muda na
-- nuvem (venda pronta baixa, cancelamento estorna, ajuste manual), o produto
-- precisa ser RE-PUBLICADO para o PDV. A view vw_produto_pdv usa
-- livro.sincronizado_em como marca de publicacao; o pull do PDV so re-busca
-- livros com sincronizado_em > cursor. Sem bumpar sincronizado_em quando o
-- estoque muda, o saldo_publicado nunca desce de volta ao PDV (fica em 0).
-- Idempotente.

-- 1) Bump da marca de publicacao do livro a cada mudanca de estoque oficial.
create or replace function bump_livro_republica()
returns trigger
language plpgsql
as $$
declare
  v_livro uuid;
begin
  v_livro := coalesce(new.livro_uid, old.livro_uid);
  if v_livro is not null then
    update livro set sincronizado_em = now() where sync_uid = v_livro;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_mov_republica_livro on movimento_estoque;
create trigger trg_mov_republica_livro
  after insert or update or delete on movimento_estoque
  for each row
  execute function bump_livro_republica();

-- 2) Backfill unico: republica o saldo atual de todo livro ativo, destravando os
--    PDVs ja atualizados (saldo op. 0 -> saldo real) sem exigir novo build.
update livro set sincronizado_em = now() where excluido_em is null;

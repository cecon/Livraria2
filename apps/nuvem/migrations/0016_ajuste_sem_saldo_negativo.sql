-- Feature 014 (FR-012, ADR-0026): ajuste MANUAL de estoque nunca deixa o saldo negativo.
--
-- A regra vive no domínio (`estoque::validar_ajuste`, via WASM no escritório);
-- esta guarda é a garantia transacional na nuvem, que é quem enxerga o saldo
-- oficial no instante do insert. Ativa só para o ajuste manual do escritório
-- (Cadastro/Pesquisa), marcado por `referencia = 'ajuste_manual'`. NÃO afeta:
-- estorno de nota cancelada (ajuste sem referencia), inventário (`contagem`),
-- venda/estorno de venda, entrada, saldo inicial nem movimentos de outra origem.
--
-- Trava a linha do livro (`for update`) para serializar ajustes concorrentes do
-- mesmo livro. A baixa de venda (0011) não usa esta trava — risco residual
-- aceito no ADR-0026.
--
-- Recusa: `raise exception 'ESTOQUE_NEGATIVO'` com o saldo atual no DETAIL
-- (o escritório traduz para "O estoque ficaria negativo (atual: N)").
--
-- Idempotente: create or replace + drop trigger if exists.

create or replace function guarda_ajuste_sem_saldo_negativo()
returns trigger
language plpgsql
as $$
declare
  v_saldo bigint;
begin
  if new.tipo = 'ajuste' and new.origem = 'escritorio' and new.referencia = 'ajuste_manual' then
    perform 1 from livro where sync_uid = new.livro_uid for update;
    select coalesce(sum(qtd), 0) into v_saldo
      from movimento_estoque
     where livro_uid = new.livro_uid and excluido_em is null;
    if v_saldo + new.qtd < 0 then
      raise exception 'ESTOQUE_NEGATIVO'
        using detail = v_saldo::text, errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ajuste_sem_saldo_negativo on movimento_estoque;
create trigger trg_ajuste_sem_saldo_negativo
  before insert on movimento_estoque
  for each row
  execute function guarda_ajuste_sem_saldo_negativo();

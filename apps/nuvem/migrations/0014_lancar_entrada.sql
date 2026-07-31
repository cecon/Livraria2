-- Feature 012 (US3): entrada de nota como efeito da nuvem.
-- RPC lancar_entrada cria um movimento_estoque 'entrada' (+qtd) por item da nota.
-- Idempotente por (nota, livro) via sync_uid deterministico (uuid_generate_v5).
-- Republica o saldo automaticamente (trigger 0012 bumpa livro.sincronizado_em).
-- SECURITY DEFINER + _exige_admin (padrao da 010). Idempotente (create or replace).

create or replace function lancar_entrada(
  p_admin text,
  p_fornecedor text,
  p_nota text,
  p_itens jsonb
) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  item jsonb;
  v_livro uuid;
  v_qtd bigint;
  v_uid uuid;
  v_por uuid;
  v_ns constant uuid := 'f5bc34a5-3b33-409c-96d0-a56664436ba7';
begin
  perform _exige_admin(p_admin);
  if p_nota is null or length(btrim(p_nota)) = 0 then
    raise exception 'Nota de entrada sem identificacao.';
  end if;
  select sync_uid into v_por from usuario where usuario = p_admin and excluido_em is null;

  for item in select jsonb_array_elements(coalesce(p_itens, '[]'::jsonb))
  loop
    v_livro := null;
    if nullif(item->>'livro_uid', '') is not null then
      select sync_uid into v_livro from livro
        where sync_uid = (item->>'livro_uid')::uuid and excluido_em is null;
    end if;
    if v_livro is null and nullif(item->>'codigo', '') is not null then
      select sync_uid into v_livro from livro
        where codigo = (item->>'codigo') and excluido_em is null;
    end if;
    if v_livro is null then
      raise exception 'Entrada com item sem produto conhecido na nuvem (codigo %).', item->>'codigo';
    end if;

    v_qtd := coalesce((item->>'qtd')::bigint, 0);
    if v_qtd <= 0 then
      raise exception 'Entrada com quantidade invalida (%) para o produto %.',
        v_qtd, coalesce(item->>'codigo', v_livro::text);
    end if;

    v_uid := uuid_generate_v5(v_ns, 'entrada:' || p_nota || ':' || v_livro::text);

    insert into movimento_estoque (
      sync_uid, livro_uid, tipo, qtd, custo_unit_centavos, fornecedor, motivo,
      referencia, criado_em, origem, atualizado_em, criado_por
    ) values (
      v_uid, v_livro, 'entrada', v_qtd, (item->>'custo_unit_centavos')::bigint, p_fornecedor,
      'Entrada de nota (retaguarda)', p_nota, now()::text, 'escritorio', now(), v_por
    )
    on conflict (sync_uid) do nothing;
  end loop;
end;
$$;

grant execute on function lancar_entrada(text, text, text, jsonb) to authenticated;

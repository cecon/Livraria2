-- Feature 012 (US4): inventario como efeito da nuvem.
-- RPC ajustar_inventario cria um movimento_estoque 'ajuste' (delta = contado - saldo)
-- por item contado. Idempotente por (sessao, livro) via sync_uid deterministico.
-- Republica o saldo (trigger 0012). SECURITY DEFINER + _exige_admin. Idempotente.

create or replace function ajustar_inventario(
  p_admin text,
  p_sessao text,
  p_itens jsonb
) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  item jsonb;
  v_livro uuid;
  v_contado bigint;
  v_saldo bigint;
  v_delta bigint;
  v_uid uuid;
  v_por uuid;
  v_ns constant uuid := 'f5bc34a5-3b33-409c-96d0-a56664436ba7';
begin
  perform _exige_admin(p_admin);
  if p_sessao is null or length(btrim(p_sessao)) = 0 then
    raise exception 'Sessao de inventario sem identificacao.';
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
      raise exception 'Inventario com item sem produto conhecido na nuvem (codigo %).', item->>'codigo';
    end if;

    v_contado := coalesce((item->>'contado')::bigint, -1);
    if v_contado < 0 then
      raise exception 'Contagem invalida (%) para o produto %.',
        v_contado, coalesce(item->>'codigo', v_livro::text);
    end if;

    select coalesce(saldo, 0) into v_saldo from vw_saldo_livro where livro_uid = v_livro;
    v_delta := v_contado - coalesce(v_saldo, 0);
    if v_delta = 0 then
      continue;  -- contagem bate com o saldo: nada a ajustar
    end if;

    v_uid := uuid_generate_v5(v_ns, 'ajuste:' || p_sessao || ':' || v_livro::text);

    insert into movimento_estoque (
      sync_uid, livro_uid, tipo, qtd, motivo, referencia, criado_em, origem,
      atualizado_em, criado_por
    ) values (
      v_uid, v_livro, 'ajuste', v_delta, 'Ajuste de inventario (retaguarda)', p_sessao,
      now()::text, 'escritorio', now(), v_por
    )
    on conflict (sync_uid) do nothing;
  end loop;
end;
$$;

grant execute on function ajustar_inventario(text, text, jsonb) to authenticated;

-- Feature 010 (US3): gestão de usuários — editar, desativar, reativar. SECURITY DEFINER,
-- admin-only. Invariante crítico (FR-014/INV-2): nunca deixar o sistema sem admin ativo —
-- reforçado AQUI (ponto de escrita), não só na UI.

-- Quantos admins ATIVOS existem (para a guarda do último admin).
create or replace function public._admins_ativos()
returns int language sql security definer set search_path = public as $$
  select count(*)::int from public.usuario where perfil = 'admin' and excluido_em is null;
$$;

-- Edita nome/perfil. Bloqueia rebaixar o ÚLTIMO admin ativo.
create or replace function public.editar_usuario(
  p_admin text, p_usuario text, p_nome text, p_perfil text
) returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_perfil text; v_excluido timestamptz;
begin
  perform public._exige_admin(p_admin);
  if p_perfil not in ('operador', 'admin') then raise exception 'perfil invalido'; end if;
  select perfil, excluido_em into v_perfil, v_excluido from public.usuario where usuario = p_usuario;
  if not found then raise exception 'usuario nao encontrado'; end if;
  if v_perfil = 'admin' and v_excluido is null and p_perfil <> 'admin' and public._admins_ativos() <= 1 then
    raise exception 'precisa de ao menos um admin';
  end if;
  update public.usuario
     set nome = nullif(trim(p_nome), ''), perfil = p_perfil, atualizado_em = now(), sincronizado_em = now()
   where usuario = p_usuario;
end $$;

-- Desativa (soft-delete). Bloqueia desativar o ÚLTIMO admin ativo. Histórico preservado.
create or replace function public.desativar_usuario(p_admin text, p_usuario text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_perfil text; v_excluido timestamptz;
begin
  perform public._exige_admin(p_admin);
  select perfil, excluido_em into v_perfil, v_excluido from public.usuario where usuario = p_usuario;
  if not found then raise exception 'usuario nao encontrado'; end if;
  if v_perfil = 'admin' and v_excluido is null and public._admins_ativos() <= 1 then
    raise exception 'precisa de ao menos um admin';
  end if;
  update public.usuario set excluido_em = now(), atualizado_em = now(), sincronizado_em = now()
   where usuario = p_usuario;
end $$;

-- Reativa um usuário desativado.
create or replace function public.reativar_usuario(p_admin text, p_usuario text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._exige_admin(p_admin);
  update public.usuario set excluido_em = null, atualizado_em = now(), sincronizado_em = now()
   where usuario = p_usuario;
  if not found then raise exception 'usuario nao encontrado'; end if;
end $$;

grant execute on function public._admins_ativos() to authenticated;
grant execute on function public.editar_usuario(text, text, text, text) to authenticated;
grant execute on function public.desativar_usuario(text, text) to authenticated;
grant execute on function public.reativar_usuario(text, text) to authenticated;

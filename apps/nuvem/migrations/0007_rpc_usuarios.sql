-- Feature 010 (ADR-0019): RPCs de gestão de usuários. Todas SECURITY DEFINER — a escrita
-- sensível (senha/perfil) só passa por aqui; o `senha_hash` nunca vai para o cliente.
-- `p_admin` é o usuário admin da sessão (vem do cookie httpOnly, server-side) e é validado.
create extension if not exists pgcrypto with schema extensions;

-- Guarda comum: o chamador precisa ser um admin ATIVO.
create or replace function public._exige_admin(p_admin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (
    select 1 from public.usuario
    where usuario = p_admin and excluido_em is null and perfil = 'admin'
  ) then
    raise exception 'sem permissao';
  end if;
end $$;

-- Cria um usuário (US1). Valida admin, unicidade, senha mínima e perfil.
create or replace function public.criar_usuario(
  p_admin text, p_usuario text, p_nome text, p_senha text, p_perfil text
) returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._exige_admin(p_admin);
  if coalesce(trim(p_usuario), '') = '' then raise exception 'usuario obrigatorio'; end if;
  if length(coalesce(p_senha, '')) < 4 then raise exception 'senha muito curta'; end if;
  if p_perfil not in ('operador', 'admin') then raise exception 'perfil invalido'; end if;
  if exists (select 1 from public.usuario where usuario = p_usuario) then
    raise exception 'usuario ja existe';
  end if;
  insert into public.usuario (sync_uid, usuario, nome, senha_hash, perfil, atualizado_em, sincronizado_em)
  values (gen_random_uuid(), p_usuario, nullif(trim(p_nome), ''),
          crypt(p_senha, gen_salt('bf')), p_perfil, now(), now());
end $$;

-- Redefine a senha de um usuário (US1/US3). Nunca lê/expõe o hash.
create or replace function public.definir_senha_usuario(
  p_admin text, p_usuario text, p_senha text
) returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._exige_admin(p_admin);
  if length(coalesce(p_senha, '')) < 4 then raise exception 'senha muito curta'; end if;
  update public.usuario
     set senha_hash = crypt(p_senha, gen_salt('bf')), atualizado_em = now(), sincronizado_em = now()
   where usuario = p_usuario;
  if not found then raise exception 'usuario nao encontrado'; end if;
end $$;

grant execute on function public._exige_admin(text) to authenticated;
grant execute on function public.criar_usuario(text, text, text, text, text) to authenticated;
grant execute on function public.definir_senha_usuario(text, text, text) to authenticated;

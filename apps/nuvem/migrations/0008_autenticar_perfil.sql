-- Feature 010 (ADR-0019, US2): autenticação que devolve o **perfil** para o gate do
-- Escritório (só admin entra). Aditiva e NÃO-quebrável: a `autenticar_usuario` (boolean,
-- 0005) passa a **delegar** a esta — o login já em produção continua funcionando (C1
-- resolvido sem deploy coordenado), e a lógica de verificação vive num lugar só (DRY).
create extension if not exists pgcrypto with schema extensions;

-- Verifica a credencial e devolve o perfil (`operador`/`admin`) do usuário ATIVO, ou NULL.
create or replace function public.autenticar_perfil(p_usuario text, p_senha text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare h text; p text;
begin
  select senha_hash, perfil into h, p from public.usuario
    where usuario = p_usuario and excluido_em is null;
  if h is null or h = '' then return null; end if;
  if (case when left(h, 2) = '$2' then crypt(p_senha, h) = h
           else encode(digest(p_senha, 'sha256'), 'hex') = h end) then
    return p;
  end if;
  return null;
end $$;

-- Compat: login boolean (ADR-0019) agora delega — mesma verificação, uma fonte só.
create or replace function public.autenticar_usuario(p_usuario text, p_senha text)
returns boolean language sql security definer set search_path = public, extensions as $$
  select public.autenticar_perfil(p_usuario, p_senha) is not null;
$$;

grant execute on function public.autenticar_perfil(text, text) to anon, authenticated;

-- Feature 008 (ADR-0019): autenticação da retaguarda pela tabela `usuario` (identidade
-- unificada com o PDV). Função SECURITY DEFINER — o `senha_hash` NUNCA sai do Postgres:
-- o texto puro entra, só volta boolean. Dupla verificação: bcrypt (`$2…`) ou SHA-256 legado
-- (migração sem quebrar logins). A retaguarda chama isto e, se ok, abre a sessão de serviço
-- compartilhada para o acesso a dados (RLS `authenticated`).
create extension if not exists pgcrypto with schema extensions;

create or replace function public.autenticar_usuario(p_usuario text, p_senha text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare h text;
begin
  select senha_hash into h from public.usuario
    where usuario = p_usuario and excluido_em is null;
  if h is null or h = '' then
    return false;
  end if;
  if left(h, 2) = '$2' then
    return crypt(p_senha, h) = h;            -- bcrypt
  else
    return encode(digest(p_senha, 'sha256'), 'hex') = h;  -- SHA-256 legado
  end if;
end;
$$;

grant execute on function public.autenticar_usuario(text, text) to anon, authenticated;

-- Usuario e identificador, nao nome de exibicao: armazenar e comparar sempre em minusculas.
-- Colisoes preexistentes exigem decisao humana; nunca fundir identidades automaticamente.
do $$
begin
  if exists (
    select lower(btrim(usuario)) from public.usuario
    group by lower(btrim(usuario)) having count(*) > 1
  ) then
    raise exception 'usuarios duplicados ao ignorar maiusculas; corrija antes da migracao';
  end if;
end $$;

update public.usuario
set usuario = lower(btrim(usuario)), atualizado_em = now(), sincronizado_em = now()
where usuario is distinct from lower(btrim(usuario));

create or replace function public._normalizar_usuario()
returns trigger language plpgsql set search_path = public as $$
begin
  new.usuario := lower(btrim(new.usuario));
  return new;
end $$;

drop trigger if exists trg_usuario_minusculo on public.usuario;
create trigger trg_usuario_minusculo before insert or update of usuario on public.usuario
for each row execute function public._normalizar_usuario();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ck_usuario_minusculo'
    and conrelid = 'public.usuario'::regclass) then
    alter table public.usuario add constraint ck_usuario_minusculo
      check (usuario = lower(btrim(usuario)) and usuario <> '');
  end if;
end $$;

create or replace function public.autenticar_perfil(p_usuario text, p_senha text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare h text; p text;
begin
  select senha_hash, perfil into h, p from public.usuario
    where usuario = lower(btrim(p_usuario)) and excluido_em is null;
  if h is null or h = '' then return null; end if;
  if (case when left(h, 2) = '$2' then crypt(p_senha, h) = h
           else encode(digest(p_senha, 'sha256'), 'hex') = h end) then
    return p;
  end if;
  return null;
end $$;

create or replace function public.autenticar_usuario(p_usuario text, p_senha text)
returns boolean language sql security definer set search_path = public, extensions as $$
  select public.autenticar_perfil(p_usuario, p_senha) is not null;
$$;

create or replace function public._exige_admin(p_admin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from public.usuario
    where usuario = lower(btrim(p_admin)) and excluido_em is null and perfil = 'admin') then
    raise exception 'sem permissao';
  end if;
end $$;

grant execute on function public.autenticar_perfil(text, text) to anon, authenticated;
grant execute on function public.autenticar_usuario(text, text) to anon, authenticated;
grant execute on function public._exige_admin(text) to authenticated;

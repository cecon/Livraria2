begin;
alter table public.livro_capa_arquivo add column if not exists content_type text;
alter table public.livro_capa_arquivo add column if not exists sha256 text;
create unique index if not exists idx_livro_capa_sha on public.livro_capa_arquivo(sha256);
alter table public.livro add column if not exists capa_uid uuid references public.livro_capa_arquivo(uid);
create or replace function public.nuvem_catalogo_publicar()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare n bigint; p jsonb; u uuid; op text;
begin
  if TG_OP = 'DELETE' then
    u := OLD.sync_uid; op := 'delete';
  else
    u := NEW.sync_uid;
    op := case when not NEW.ativo or NEW.excluido_em is not null then 'delete' else 'upsert' end;
    if op = 'upsert' then
      if NEW.preco_centavos < 0 or NEW.preco_centavos > 9007199254740991 then
        raise exception 'Preco fora do contrato em centavos';
      end if;
      p := jsonb_build_object(
        'codigo', NEW.codigo, 'titulo', NEW.titulo, 'autor', NEW.autor,
        'precoCentavos', NEW.preco_centavos, 'ativo', NEW.ativo,
        'capaUid', NEW.capa_uid, 'categoria', NEW.categoria, 'descricao', NEW.descricao,
        'buscaNorm', NEW.busca_norm, 'saldoPublicado', public.nuvem_saldo_produto(u));
    end if;
  end if;
  update public.nuvem_sync_contador set sequencia = sequencia + 1
    where id = 1 returning sequencia into n;
  insert into public.nuvem_catalogo_evento(sequencia, produto_uid, operacao, produto)
    values (n, u, op, p);
  return null;
end $$;

-- Recupera somente referências internas existentes; não busca URLs externas.
update public.livro l set capa_uid=a.uid from public.livro_complemento c, public.livro_capa_arquivo a
where c.livro_uid=l.sync_uid and c.capa_url='/api/capas/'||a.uid::text and l.capa_uid is null;
commit;

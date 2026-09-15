begin;

do $$
declare
  regra text;
begin
  if to_regclass('public.divergencia_estoque') is not null then
    raise exception 'divergencia_estoque ainda existe';
  end if;

  select pg_get_constraintdef(oid) into regra
    from pg_constraint
   where conname = 'pedido_estoque_status_check';

  if regra is null or regra like '%divergente%' then
    raise exception 'restricao de estoque ainda aceita divergente: %', regra;
  end if;

  if pg_get_functiondef('incorporar_pedido(uuid)'::regprocedure) like '%divergencia_estoque%' then
    raise exception 'incorporar_pedido ainda depende de divergencia_estoque';
  end if;
end $$;

rollback;

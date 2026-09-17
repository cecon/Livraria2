-- Turnos do PDV pertencem ao cadastro estavel da maquina, nao ao nome do PC.
-- Historico anterior e turnos do escritorio continuam nullable.
begin;
alter table public.turno_operacao
  add column if not exists pdv_uid uuid references public.nuvem_pdv(uid);
create index if not exists idx_turno_operacao_pdv_uid
  on public.turno_operacao(pdv_uid);
create unique index if not exists idx_turno_operacao_aberto_pdv_uid
  on public.turno_operacao(pdv_uid)
  where pdv_uid is not null and status = 'aberto' and excluido_em is null;
commit;

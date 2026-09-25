begin;
-- A nuvem espelha turnos enviados por PDVs on-premise e nao deve bloquear a
-- recuperacao quando um turno antigo ficou aberto no servidor. A garantia de
-- um turno ativo continua sendo responsabilidade do PDV local; a API precisa
-- aceitar reenvios e novos turnos para reconciliar depois.
drop index if exists public.idx_turno_operacao_aberto_pdv_uid;
commit;

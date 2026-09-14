-- Feature 013 (US5, FR-015): a MÁQUINA compõe a identidade do turno.
--
-- O turno passa a pertencer ao PDV (nome do PC) e não ao operador: um único
-- turno aberto por máquina, e o mesmo usuário em outra máquina abre outro turno
-- (sem colisão no sync). O PDV grava `turno_operacao.maquina` local desde a m014;
-- esta migração abre espaço para a coluna subir.
--
-- ORDEM DE ROLLOUT (importante): aplicar ANTES de publicar o app que envia a
-- coluna. Se o push mandar `maquina` e a coluna não existir, o upsert do recurso
-- `turno_operacao` falha e o sync do turno para. Aplicar esta migração primeiro
-- é seguro nos dois sentidos: clientes antigos simplesmente não enviam o campo.
--
-- Aditiva e idempotente: `add column if not exists`, sem default e nullable
-- (turnos históricos e os abertos pelo Escritório seguem sem máquina).

alter table turno_operacao add column if not exists maquina text;

comment on column turno_operacao.maquina is
  'Nome do PC que abriu o turno (feature 013, FR-015). Nulo em turno do escritório ou anterior à 013.';

-- Consulta típica do escritório (US6): turnos por máquina/estado.
create index if not exists idx_turno_operacao_maquina on turno_operacao (maquina, status);

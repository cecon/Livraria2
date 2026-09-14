-- Feature 013 (US6, FR-014): turno padrao para as vendas historicas sem turno.
--
-- A partir da 013 toda venda pertence a um turno. As vendas anteriores (e as
-- importadas do legado) tem `turno_uid` nulo, o que deixaria a visao de turnos
-- do escritorio incompleta e o SC-009 (zero pedidos sem turno) impossivel.
--
-- Decisao do clarify: UM UNICO turno padrao GLOBAL (nao um por PDV/loja), ja
-- criado fechado/conferido — ele nao representa uma sessao real de caixa, e sim
-- o balde do historico anterior a regra.
--
-- Aditiva e idempotente: o turno tem sync_uid fixo e entra com `on conflict do
-- nothing`; o backfill so toca linhas com turno_uid nulo. Reaplicar nao duplica
-- nem re-carimba nada.

-- 1) O turno padrao global. `operador_uid` fica nulo de proposito: nao houve
--    operador — é historico. `maquina` idem (coluna criada na 0014).
insert into turno_operacao (
  sync_uid, operador_uid, caixa_inicial_centavos, status, abertura, encerramento,
  esperado_centavos, conferido_centavos, diferenca_centavos, origem, atualizado_em
)
values (
  '00000000-0013-0000-0000-000000000001', null, 0, 'encerrado',
  '2000-01-01T00:00:00', '2000-01-01T00:00:00',
  0, 0, 0, 'escritorio', now()
)
on conflict (sync_uid) do nothing;

comment on table turno_operacao is
  'Turnos de operacao. O sync_uid 00000000-0013-0000-0000-000000000001 e o turno padrao global do historico anterior a feature 013 (FR-014).';

-- 2) Backfill: toda venda sem turno passa a pertencer ao padrao.
--    `atualizado_em` NAO e bumpado: isso e reparo de historico, nao mudanca de
--    conteudo — bumpar faria o LWW re-descer vendas antigas para os PDVs.
update pedido
   set turno_uid = '00000000-0013-0000-0000-000000000001'
 where turno_uid is null;

-- 3) Indice da consulta do escritorio (US6): vendas por turno.
create index if not exists idx_pedido_turno on pedido (turno_uid);

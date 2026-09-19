# Integração de Produtos e pendências

Base operacional: `codex/pdv-caixa-movimentos`, incluindo as alterações locais do caixa
preservadas no commit 5555af4, mais origin/main em 2c0b703. Não usar como base a antiga
`codex/013-cadastro-rapido-estoque` nem a correção isolada de fechamento sobre 26.9.13.

Produtos consulta réplica local; criação, edição e contagem física usam API NestJS com
autorização de administrador. O estoque oficial e a auditoria permanecem na nuvem.
Operações usam UUID idempotente; contagem exige versão atual, registra diferença e responsável.
Importação pontual por UID não avança cursor e protege contra eventos atrasados.

## Reconciliação de PRs anteriores

- PR 24, `fix/venda-escritorio-paridade`: foi escrito para a tela de venda do Escritório
  anterior à separação PDV/retaguarda. A tela foi deliberadamente retirada; permanecem
  a consulta de vendas na nuvem e pagamentos em centavos no PDV. Não restaurar a tela.
- PR 23, `013-venda-turno-retencao`: usa os diretórios antigos `src-tauri`, `src` e
  `apps/escritorio`, protocolo de réplica anterior e migração m014 incompatível com a atual.
  Vínculo venda/turno/máquina, envio com confirmação e seleção explícita de operador são
  atendidos pelo modelo atual. Preservar histórico local e política atual de cancelamento;
  a poda automática de 45 dias e o encerramento remoto não são reativados nesta integração.
  O histórico desses PRs é reconciliado sem substituir implementações mais novas.
- Branches remotas de exportação, WhatsApp, ações mobile e monitoramento já entraram por
  squash nos PRs 44–47. Suas correções estão presentes pela integração de origin/main.

## Publicação

Aplicar `apps/nuvem/api/sql/005_produtos_pdv.sql` pelo migrator antes de disponibilizar o
cliente. Publicar API e proxy web juntos. O esquema SQLite m018 é aditivo e idempotente.
Não fechar turnos reais para testar. Manter backup do executável e SQLite antes da atualização.

## Evidências

- Testes de API em PostgreSQL isolado: autorização, idempotência, concorrência, rollback e estoque.
- Testes SQLite de importação: 501 eventos atrasados, cursor, identidade e snapshot mais novo.
- Testes web do proxy e build de API/web/PDV.
- Testes de interface em desktop/mobile, claro/escuro e retorno do fechamento ao início.

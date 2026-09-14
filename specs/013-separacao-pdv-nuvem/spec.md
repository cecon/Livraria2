# Separacao definitiva entre PDV e nuvem

Data: 2026-09-14. Status: implementacao incremental.

## Cenarios e aceitacao

1. O caixa vende, recebe pagamentos e fecha turnos sem internet. Ao reconectar,
   reenvia operacoes sem duplicar pedidos ou pagamentos.
2. O administrador altera preco/codigo na nuvem e identifica quais PDVs receberam
   a alteracao. Renomear codigo preserva a identidade e o historico do produto.
3. Uma exclusao chega como evento explicito; produtos removidos deixam de aparecer
   no caixa sem apagar registros de vendas anteriores.
4. Cada aplicacao pode ser compilada e publicada separadamente.

## Requisitos

- FR-001: separar codigo nativo e layout do PDV do administrativo e backend.
- FR-002: manter identidade estavel por UUID, independentemente de codigo/ISBN.
- FR-003: catalogo, precos e administracao pertencem a nuvem.
- FR-004: venda, caixa, pagamentos e operacao offline pertencem ao PDV.
- FR-005: comunicacao futura usa contratos versionados pela API autenticada.
- FR-006: alteracoes usam sequencia duravel; cursor avanca apenas apos aplicacao
  transacional de toda a pagina, com confirmacao por dispositivo.
- FR-007: reenvios usam chave idempotente e retornam o resultado original.
- FR-008: exclusoes e trocas de codigo preservam vendas e estoque.
- FR-009: manter dados e servicos atuais durante a transicao.
- FR-010: diferenciar recebido, aplicado e confirmado por PDV.

## Entidades

Produto (UUID estavel), operacao de venda (UUID e chave idempotente), evento de
catalogo (sequencia), dispositivo PDV e confirmacao de cursor.

## Criterios de sucesso

- Builds independentes do PDV, web e API.
- Venda offline continua funcional.
- Reaplicar uma pagina nao duplica registros.
- Alterar 503 para ISBN atualiza o mesmo produto em todos os dispositivos.
- Administrador pode verificar a confirmacao de uma alteracao por caixa.

## Premissas

PostgreSQL atual e dados existentes serao preservados. A primeira entrega separa
pastas e introduz o backend; migracao de fluxos ocorre em entregas posteriores.
Layout mobile local ainda nao integrado permanece no worktree original.

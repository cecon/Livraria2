# Architecture Decision Records (ADRs)

Registro versionado das decisões de arquitetura (Constituição, Princípio V). Formato leve (MADR).
As decisões nascem do `/speckit-plan` (ver `specs/001-sistema-estoque-vendas/research.md`).

| ADR | Título | Status |
|---|---|---|
| [0001](0001-persistencia-sqlite.md) | Persistência em SQLite local | Aceito |
| [0002](0002-nucleo-rust-hexagonal.md) | Núcleo de domínio em Rust + Hexagonal/SOLID | Aceito |
| [0003](0003-orm-seaorm.md) | ORM SeaORM na camada de dados | Aceito |
| [0004](0004-migrations-idempotentes.md) | Migrations por comando, idempotentes | Aceito |
| [0005](0005-dinheiro-em-centavos.md) | Dinheiro como inteiro em centavos | Aceito |
| [0006](0006-import-legado-idempotente.md) | Import do legado Access via mdbtools (upsert) | Aceito |
| [0007](0007-guardrails-hooks-skills.md) | Guardrails: hook de 300 linhas, skills, ADRs | Aceito |
| [0008](0008-razao-movimentos-estoque.md) | Razão de movimentos como fonte da verdade do estoque | Aceito |
| [0009](0009-custo-medio-ponderado.md) | Custo médio ponderado por livro | Aceito |
| [0010](0010-inventario-reconciliacao.md) | Inventário: sessão parcial/total e reconciliação no fechamento | Aceito |
| [0011](0011-fornecedores-lancamento-notas.md) | Fornecedores e lançamento de entrada por nota | Aceito |
| [0012](0012-identidade-livro-id.md) | Identidade do livro: `id` numérico e `codigo` (barcode) único | Aceito |
| [0013](0013-cadastro-formas-pagamento.md) | Cadastro de formas de pagamento: registro + junção e migração m006 | Aceito |
| [0014](0014-destinacao-doacoes.md) | Destinação de doações: Loja como resíduo, carimbos com prioridade de venda | Aceito |
| [0015](0015-sincronizacao-nuvem.md) | Sincronização com a nuvem: hub Supabase, PDV réplica offline, escritório web | Aceito |
| [0016](0016-sync-identidade-convergencia.md) | Sincronização: identidade estável, deduplicação e convergência idempotente | Aceito |
| [0017](0017-saldo-inicial-obrigatorio-ledger-completo.md) | Estoque: `saldo_inicial` obrigatório e reparo do ledger incompleto | Aceito |
| [0018](0018-baixa-venda-limitada-ao-estoque-cacheado.md) | Baixa de venda limitada ao estoque cacheado: drift silencioso quando o cache diverge | Aceito |

**Versionamento**: um arquivo por decisão, numeração sequencial. Mudança de decisão → novo ADR que
"supersedes" o anterior (não reescrever o histórico).

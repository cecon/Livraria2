# Decisões de arquitetura

A [Constituição 3.0.0](../../.specify/memory/constitution.md) e a
[ADR-0034](0034-governanca-pdv-cloud.md) consolidam as regras vigentes.
Comece pela [ADR-0032](0032-interfaces-independentes-api-unica.md): apenas PDV e Cloud,
interfaces independentes e API como fronteira. Decisão aceita não comprova implantação.

ADRs antigas mantêm o texto original para auditoria. O aviso de vigência no início
explica o que ainda se aplica. Não usar uma decisão substituída para orientar código novo.
Renomeações futuras, integrações retiradas e nomes históricos não são arquitetura em produção.

| ADR | Decisão | Vigência |
|---|---|---|
| [0001](0001-persistencia-sqlite.md) | Persistência em SQLite local | Vigente no PDV |
| [0002](0002-nucleo-rust-hexagonal.md) | Núcleo de domínio em Rust + Hexagonal/SOLID | Vigente com escopo |
| [0003](0003-orm-seaorm.md) | ORM SeaORM na camada de dados | Vigente no PDV |
| [0004](0004-migrations-idempotentes.md) | Migrations por comando, idempotentes | Complementada |
| [0005](0005-dinheiro-em-centavos.md) | Dinheiro como inteiro em centavos | Vigente |
| [0006](0006-import-legado-idempotente.md) | Import do legado Access via mdbtools (upsert idempotente) | Historica: importacao |
| [0007](0007-guardrails-hooks-skills.md) | Guardrails: hook de 300 linhas, skills e ADRs | Vigente |
| [0008](0008-razao-movimentos-estoque.md) | Razão de movimentos como fonte da verdade do estoque | Vigente na nuvem |
| [0009](0009-custo-medio-ponderado.md) | Custo médio ponderado por livro | Vigente |
| [0010](0010-inventario-reconciliacao.md) | Inventário: sessão parcial/total e reconciliação no fechamento | Complementada |
| [0011](0011-fornecedores-lancamento-notas.md) | Fornecedores e lançamento de entrada por nota | Complementada |
| [0012](0012-identidade-livro-id.md) | Identidade do livro: `id` numérico e `codigo` (barcode) único | Parcialmente substituida |
| [0013](0013-cadastro-formas-pagamento.md) | Cadastro de formas de pagamento: registro + junção, chave estável e migração m006 | Vigente |
| [0014](0014-destinacao-doacoes.md) | Destinação de estoque para doações: Loja como resíduo, carimbos com prioridade de venda | Vigente |
| [0015](0015-sincronizacao-nuvem.md) | Sincronização com a nuvem: hub Supabase, PDV réplica offline, escritório web | Substituida |
| [0016](0016-sync-identidade-convergencia.md) | Sincronização: identidade estável, deduplicação e convergência idempotente | Parcialmente vigente |
| [0017](0017-saldo-inicial-obrigatorio-ledger-completo.md) | Estoque: `saldo_inicial` obrigatório e reparo do ledger incompleto | Parcialmente vigente |
| [0018](0018-baixa-venda-limitada-ao-estoque-cacheado.md) | Baixa de venda limitada ao estoque cacheado: drift silencioso quando o cache diverge | Substituida para estoque oficial |
| [0019](0019-identidade-unificada-usuario-senha-sincronizada.md) | Identidade unificada na tabela `usuario`: senha sincronizada e protegida | Parcialmente substituida |
| [0020](0020-ui-compartilhada-workspace.md) | UI compartilhada via `packages/ui` + workspace | Substituida |
| [0021](0021-turno-de-operacao.md) | Turno de operação: entidade de domínio, Pedido Nº por turno, abrir/encerrar | Vigente |
| [0022](0022-escritorio-reusa-dominio-wasm.md) | Escritório reusa o domínio (Rust) via WebAssembly | Opcao tecnica existente |
| [0023](0023-estoque-oficial-nuvem-venda-pronta.md) | Estoque oficial na nuvem por venda pronta | Vigente |
| [0024](0024-separacao-pdv-nuvem.md) | Separar PDV e nuvem com API dedicada | Complementada |
| [0025](0025-identificador-usuario-minusculo.md) | identificador de usuario em minusculas | Vigente |
| [0026](0026-tema-wowdash-referencia-visual-obrigatoria.md) | Tema WowDash como referencia visual obrigatoria | Complementada |
| [0027](0027-convencoes-de-interface-no-agentmemory.md) | Convencoes de interface persistidas no AgentMemory | Complementada |
| [0028](0028-web-nuvem-exclusivamente-api-nestjs.md) | Web da nuvem exclusivamente pela API NestJS | Vigente |
| [0029](0029-remocao-fila-divergencias-estoque.md) | Remover fila de divergencias de estoque | Vigente |
| [0030](0030-modelo-comercial-pdv-e-livro-caixa.md) | Modelo comercial do PDV e livro-caixa | Implementacao parcial |
| [0031](0031-llm-identidade-turno.md) | LLM central e identidade do operador do turno | Vigente |
| [0032](0032-interfaces-independentes-api-unica.md) | Dois produtos, interfaces independentes e API da nuvem | Aceita; ver pendências |
| [0034](0034-governanca-pdv-cloud.md) | Governança vigente do PDV e Cloud | Vigente |
| [0035](0035-deploy-cloud-dokploy.md) | Deploy Cloud pelo Dokploy após publicação das imagens | Vigente |
| [0036](0036-graphify-agentmemory.md) | Graphify e AgentMemory no trabalho dos agentes | Vigente |
| [0037](0037-cadastro-pdv-adm-tecnico.md) | Cadastro pelo canal do PDV com adm técnico | Aceita |

Novas decisões recebem número ainda não utilizado. A numeração 0033 está reservada ao
registro local sobre binding WASM gerado; esta revisão não presume essa exceção implantada.
Alterar decisão exige nova ADR ou complemento explícito, com data, consequências e evidência.

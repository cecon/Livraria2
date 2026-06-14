# Contracts — Tauri Commands (invoke API)

Porta de entrada do núcleo Rust. A UI React chama via `invoke(nome, args)`. Todos retornam
`Result<T, ErroApp>` (erro serializado como `{ codigo, mensagem }`). **Dinheiro trafega em centavos i64.**
Datas em ISO `yyyy-mm-dd`. Esta é a fronteira de contrato; a forma exata dos DTOs é fixada na implementação.

## Convenções
- Erros de domínio → `ErroApp { codigo: string, mensagem: string }` (ex.: `SEM_ITENS`, `PAGO_INSUFICIENTE`,
  `LIVRO_NAO_ENCONTRADO`, `CODIGO_INVALIDO`).
- Sucesso → DTO tipado (espelhado em `src/lib/types.ts`).

## Cadastro / Acervo
| Comando | Args | Retorno |
|---|---|---|
| `livro_por_codigo` | `{ codigo }` | `Livro | null` |
| `salvar_livro` | `{ livro: LivroInput }` | `Livro` (upsert por código) |
| `excluir_livro` | `{ codigo }` | `void` (soft-delete) |
| `livros_recentes` | `{ limite?: number }` | `Livro[]` |

## Pesquisa
| Comando | Args | Retorno |
|---|---|---|
| `buscar_por_codigo` | `{ codigo }` | `Livro | null` |
| `buscar_por_texto` | `{ termo }` | `Livro[]` (sem acento/caixa; ordenado por relevância) |

## Venda / PDV
| Comando | Args | Retorno |
|---|---|---|
| `proximo_numero_pedido` | `{}` | `number` |
| `registrar_venda` | `{ venda: VendaInput }` | `Pedido` |

`VendaInput`: `{ cliente, itens: [{ codigo, qtd }], pagamentos: { cartao, dinheiro, pix, ministerio, vale } }`
(centavos). Regras aplicadas no domínio: ≥1 item, `pago>=total`, baixa de estoque, nº pedido, turno por
horário (servidor decide o turno via porta Relógio).

## Início / Dashboard
| Comando | Args | Retorno |
|---|---|---|
| `dashboard_do_dia` | `{ data? }` | `{ vendas_centavos, itens_vendidos, ticket_medio_centavos, estoque_baixo: Livro[] }` |

## Relatórios
| Comando | Args | Retorno |
|---|---|---|
| `autenticar` | `{ usuario, senha }` | `{ ok: boolean }` |
| `relatorio_vendas` | `{ data, periodo: 'dia'|'manha'|'tarde' }` | `RelatorioVendas` (itens por pedido + resumo por forma + subtotal Din+Cartão+PIX) |
| `relatorio_estoque` | `{}` | `RelatorioEstoque` (livros ordenados por estoque asc + valor total) |
| `zerar_caixa` | `{ turno }` | `void` (reinicia totais do turno) |

## Migração / Sincronização (transição)
| Comando | Args | Retorno |
|---|---|---|
| `migrar_legado` | `{ caminho_mdb? }` | `RelatorioMigracao { livros_inseridos, livros_atualizados, pedidos_inseridos, pedidos_atualizados, descartados, divergencias }` |
| `inicializar_dados` | `{}` | `void` (roda migrations idempotentes) |

`migrar_legado` é **idempotente** (upsert); pode ser re-executado durante a transição (D6).

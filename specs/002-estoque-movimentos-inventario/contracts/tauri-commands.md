# Contracts — Tauri Commands (invoke API): Estoque & Inventário

Novos comandos da feature 002, na mesma fronteira da 001. UI React chama via `invoke(nome, args)`. Todos
retornam `Result<T, ErroApp>` (erro = `{ codigo, mensagem }`). **Dinheiro em centavos i64**; datas ISO.
DTOs em **camelCase** (espelham `src/lib/types.ts`). A forma exata é fixada na implementação.

## Convenções de erro (novos códigos)
`QTD_INVALIDA` (qtd ≤ 0), `MOTIVO_OBRIGATORIO` (ajuste sem motivo), `ESTOQUE_NEGATIVO` (ajuste deixaria < 0),
`SESSAO_NAO_ENCONTRADA`, `SESSAO_JA_FECHADA`, `SESSAO_ABERTA_EXISTENTE` (tentar abrir com uma já aberta),
`LIVRO_NAO_ENCONTRADO`.

## Entrada de mercadoria (compra) — US1
| Comando | Args | Retorno |
|---|---|---|
| `registrar_entrada` | `{ entrada: EntradaInput }` | `Livro` (com estoque e custo médio atualizados) |
| `fornecedores_sugestoes` | `{ prefixo?: string }` | `string[]` (fornecedores já usados) |

`EntradaInput`: `{ codigo, qtd, fornecedor, custoTotalCentavos?: number, custoUnitCentavos?: number }`
— informar **um** dos custos; o servidor deriva o outro (`derivar_custos`). Regras no domínio: `qtd > 0`;
recálculo de `custo_medio`; movimento `entrada` (com `custoUnitCentavos`, `fornecedor`).

## Ajuste avulso — US3
| Comando | Args | Retorno |
|---|---|---|
| `registrar_ajuste` | `{ codigo, qtd: number, motivo: string }` | `Livro` |

`qtd` com sinal (ex.: `-2`). Regras: `motivo` não-vazio (`MOTIVO_OBRIGATORIO`); resultado ≥ 0
(`ESTOQUE_NEGATIVO`); gera movimento `ajuste`.

## Extrato de movimentação — US4
| Comando | Args | Retorno |
|---|---|---|
| `extrato_livro` | `{ codigo, limite?: number }` | `MovimentoView[]` |

`MovimentoView`: `{ id, tipo, qtd, saldoResultante, custoUnitCentavos?, fornecedor?, motivo?, referencia?, criadoEm }`
— ordem cronológica; `saldoResultante` é o saldo acumulado após cada movimento.

## Inventário (sessão por bipagem) — US2
| Comando | Args | Retorno |
|---|---|---|
| `inventario_abrir` | `{ modo: 'parcial'|'total', rotulo?: string }` | `SessaoDto` |
| `inventario_sessao_aberta` | `{}` | `SessaoDto | null` (retomar sessão no boot) |
| `inventario_bipar` | `{ sessaoId, codigoBarras }` | `ResultadoBipagem` |
| `inventario_ajustar_item` | `{ sessaoId, codigo, qtdContada }` | `void` (ajuste manual da contagem) |
| `inventario_revisao` | `{ sessaoId }` | `DivergenciaView[]` |
| `inventario_fechar` | `{ sessaoId, confirmarTotal?: boolean }` | `RelatorioFechamento` |
| `inventario_cancelar` | `{ sessaoId }` | `void` |
| `inventario_pendencias` | `{ sessaoId?: number, apenasAbertas?: boolean }` | `PendenciaView[]` |
| `inventario_divergencias` | `{ sessaoId }` | `DivergenciaView[]` (relatório de sessão fechada, reconstruído dos movimentos `contagem`) |

- `SessaoDto`: `{ id, modo, rotulo, status, abertaEm }`.
- `ResultadoBipagem`: `{ encontrado: boolean, livro?: Livro, qtdContada?: number, pendencia?: PendenciaView }`
  — achou por `codigo_barras` **ou** `codigo` (PK) → incrementa e devolve `qtdContada`; não achou → cria/atualiza
  pendência. (Busca por nome é feita pela UI via `buscar_por_texto` quando o operador opta por procurar manualmente.)
- `DivergenciaView`: `{ codigo, titulo, qtdSistema, qtdContada, diferenca }`.
- `RelatorioFechamento`: `{ sessaoId, ajustados: DivergenciaView[], totalDiferencas, pendencias: PendenciaView[] }`.
  Modo `total` exige `confirmarTotal: true` (senão erro/aviso), pois zera livros não bipados.
- `PendenciaView`: `{ id, codigoLido, qtd, resolvida }`.

## Cadastro / Acervo (ALTERADO — US5 e D4)
| Comando | Args | Retorno |
|---|---|---|
| `salvar_livro` | `{ livro: LivroInput }` | `Livro` (upsert) — `LivroInput` ganha `codigoBarras?: string` |
| `buscar_por_codigo_barras` | `{ codigoBarras }` | `Livro | null` |
| `resolver_pendencia` | `{ pendenciaId }` | `void` (marca resolvida ao cadastrar/dar entrada) |

`LivroDto`/`Livro` passam a incluir `codigoBarras?: string` e `custoMedioCentavos: number`.

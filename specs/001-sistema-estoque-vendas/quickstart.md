# Quickstart — Validação ponta a ponta (Livraria 2)

Guia para provar que a feature funciona. Detalhes de implementação ficam em `tasks.md`.
Referências: [data-model.md](data-model.md) · [contracts/tauri-commands.md](contracts/tauri-commands.md) ·
[research.md](research.md).

## Pré-requisitos
- Node 22+, Rust 1.93+, `mdbtools` instalado (`mdb-export --version`).
- Legado em `../Livraria/livraria.mdb` acessível.
- Deps instaladas: `npm install` (raiz).

## Comandos
```bash
# Domínio + aplicação (puro, sem UI/banco) — deve passar isolado
cargo test --manifest-path src-tauri/Cargo.toml

# App desktop (dev)
npm run tauri dev

# Build completo
npm run build && cargo check --manifest-path src-tauri/Cargo.toml

# Guardrail de tamanho (300 linhas)
scripts/check-file-size            # falha se algum arquivo de lógica > 300 linhas significativas
```

## Cenários de aceite (mapeados à spec)

1. **Inicialização idempotente (FR-061, SC-005)**: rodar `inicializar_dados` duas vezes → segunda
   execução sem erro, sem duplicar tabelas/dados.
2. **Migração do legado (FR-065..069, SC-009)**: rodar `migrar_legado` → ~503 livros e ~5.109 vendas
   importados; rodar de novo → relatório mostra 0 inserções novas e nenhum duplicado (upsert).
3. **Venda no PDV (US1, FR-010..017, SC-001/002)**: escanear 1 código → item add; escanear de novo →
   qtd soma; preencher pagamento ≥ total → `registrar_venda` grava pedido, baixa estoque, nº incrementa.
4. **Bloqueios (FR-014)**: receber sem itens → `SEM_ITENS`; pago < total → `PAGO_INSUFICIENTE` com falta.
5. **Cadastro (US2)**: código novo → form vazio; código existente → form preenchido; salvar → upsert.
6. **Busca sem acento (FR-021, SC-003)**: `buscar_por_texto("biblia")` retorna "Bíblia".
7. **Dashboard (US4)**: após vendas, `dashboard_do_dia` reflete vendas/itens/ticket e estoque baixo.
8. **Relatórios (US5, FR-040..045, SC-004)**: `relatorio_vendas` reconcilia (Σ formas = Σ totais, R$ 0,00).
9. **Dinheiro em centavos (D4, SC-004)**: somatórios sem erro de arredondamento.
10. **Guardrail (US6, FR-071, SC-006)**: criar arquivo `.rs/.ts` > 300 linhas significativas → hook/
    pre-commit bloqueia.

## Definition of Done (v1)
- `cargo test` do domínio/aplicação verde sem UI nem banco.
- Migrations e import idempotentes (cenários 1–2).
- Telas das US1–US5 operáveis via `npm run tauri dev`.
- Guardrail de 300 linhas ativo; ADRs em `docs/adr/`.

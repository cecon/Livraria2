# Quickstart — Validação: Fornecedores & Lançamento de Notas

Guia de validação ponta a ponta. Detalhes em [data-model.md](data-model.md) e
[contracts/tauri-commands.md](contracts/tauri-commands.md). Implementação fica em `tasks.md`.

## Pré-requisitos

- Features 001/002 funcionando (livro, razão de movimentos, custo médio). Sem novas dependências.
- Alguns livros cadastrados.

## Setup

```bash
cd src-tauri && cargo test        # domínio (fornecedor/lançamento) + adapters (SQLite temporário)
cd .. && npm run build            # tsc + vite
npm run tauri dev                 # app
```

No primeiro boot após a migration `m_fornecedores`, o passo `semear_fornecedores` cria fornecedores a partir
dos nomes já usados nas entradas da 002.

## Cenários de validação

### 1. Cadastro de fornecedores (US1, FR-001..004)
1. Abrir **Fornecedores** → "Novo" → cadastrar "Editora X" (com telefone). Aparece na lista.
2. Tentar cadastrar "editora x" de novo → erro `FORNECEDOR_DUPLICADO` (mesmo nome normalizado).
3. Editar telefone; buscar por "edit" → filtra. Inativar → some da seleção, mas notas antigas o mantêm.

### 2. Seed de fornecedores (D2, FR-005)
1. Numa base que já teve entradas na 002 com fornecedor em texto, abrir Fornecedores.
2. **Esperado**: os nomes distintos já usados aparecem como fornecedores cadastrados (sem duplicar).

### 3. Novo lançamento multi-item e dar entrada (US2/US3, SC-001/002)
1. **Lançamentos** → "Novo lançamento" → escolher "Editora X".
2. Adicionar 3 livros (campo único com autosearch): qtd e custo (alternar total/unitário). Subtotais batem.
3. **Dar entrada** → estoque dos 3 sobe pela qtd; custo médio recalculado; no Extrato de cada livro há um
   movimento **Entrada** com `referência` = id da nota. A nota fica **finalizada** na lista.
4. Reabrir a nota finalizada → somente leitura (itens e valores).

### 4. Rascunho retomável (US4, FR-020..023)
1. Novo lançamento, escolher fornecedor, adicionar 2 itens, **Salvar rascunho** (ou sair).
2. **Esperado**: a nota aparece como **rascunho**; estoque **não** mudou.
3. Reabrir o rascunho, adicionar +1 item, **dar entrada** → os 3 sobem de uma vez; vira finalizada.
4. Criar outro rascunho e **excluí-lo** → some da lista, nada lançado no estoque.

### 5. Item repetido e validações (Q1, FR-013/016)
1. Adicionar o mesmo livro 2× → **soma na mesma linha** (uma linha, qtd somada).
2. Tentar dar entrada sem fornecedor ou sem itens → bloqueado com mensagem.
3. Tentar finalizar a mesma nota duas vezes → não reaplica estoque (idempotente, SC-006).

### 6. Substituição da Entrada antiga (D5)
1. A tela "Entrada de mercadoria" (1 livro) **não existe mais**; a navegação leva a **Lançamentos**.

## Critérios de aceite (resumo)
- SC-001 movimentos vinculados à nota + reconciliação; SC-002 nota de 5 itens < 2 min; SC-003 fornecedor < 10 s;
  SC-004 sem fornecedor divergente; SC-005 notas consultáveis; SC-006 sem dupla aplicação.
- `cargo test` cobre as regras puras (validação de fornecedor, total, `pode_finalizar`) e a finalização
  atômica/idempotente (adapter), sem depender da UI.

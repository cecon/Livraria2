# Phase 1 — Contratos Tauri (comandos invoke)

Convenção atual: comandos `#[tauri::command]` em `commands*.rs`, registrados em `lib.rs`, espelhados em `src/lib/ipc.ts`. Dinheiro sempre em **centavos inteiros**.

## NOVO — Estado do boot (`lib.rs`, FR-016a)

### `estado_boot`
- **Args**: nenhum.
- **Retorno**: `{ ok: boolean, erroMigracao?: string }`.
  - `ok=true`: migrações aplicadas; app opera normalmente.
  - `ok=false`: a `m006` (ou migração anterior) falhou com rollback; `erroMigracao` traz a mensagem descritiva. O frontend consulta este comando na inicialização (`App.tsx`) e, em falha, renderiza APENAS `ErroMigracao.tsx` — sem navegação, PDV ou cadastros.
- **Implementação**: o setup do Tauri captura o `Err` de `migration::m006::aplicar` (propagado por `adapters/persistencia/mod.rs`) e guarda o estado em `State` gerenciado, em vez de abortar o processo — o app abre só para exibir o erro.
- **Erros**: nenhum (o comando sempre responde; a falha é dado, não exceção).

## NOVOS — Cadastro de formas (`commands_formas.rs`)

### `listar_formas`
- **Args**: nenhum.
- **Retorno**: `FormaPagamento[]` ordenado por `ordem` (inclui inativas — para a tela de cadastro).
- `FormaPagamento { id: number, chave: string, rotulo: string, deSistema: boolean, ativa: boolean, ordem: number }`.

### `listar_formas_ativas`
- **Args**: nenhum.
- **Retorno**: `FormaPagamento[]` só ativas, por `ordem` (consumido pelo PDV).

### `criar_forma`
- **Args**: `{ rotulo: string, ativa: boolean }`.
- **Retorno**: `FormaPagamento` criada (chave gerada do rótulo normalizado, garantida única; `deSistema=false`; `ordem` = última+1).
- **Erros**: rótulo vazio; rótulo duplicado entre ativas por comparação **normalizada** — caixa/acentos insensível, espaços aparados (FR-010/D9).

### `renomear_forma`
- **Args**: `{ id: number, rotulo: string }`.
- **Retorno**: `FormaPagamento`. `chave` inalterada (FR-006).
- **Erros**: rótulo vazio/duplicado (comparação normalizada, FR-010/D9); forma inexistente.

### `definir_forma_ativa`
- **Args**: `{ id: number, ativa: boolean }`.
- **Retorno**: `FormaPagamento`.
- **Erros**: forma de sistema (não pode desativar — FR-001a/FR-007); desativar a última ativa (FR-011); **reativar com rótulo conflitante** com uma forma ativa (comparação normalizada) → bloqueado com mensagem orientando renomear antes (FR-007/D9).

### `reordenar_formas`
- **Args**: `{ idsOrdenados: number[] }` (nova ordem completa).
- **Retorno**: `FormaPagamento[]` reordenada.

### `excluir_forma`
- **Args**: `{ id: number }`.
- **Retorno**: `void`.
- **Erros**: forma de sistema; forma em uso em vendas (FR-009) → mensagem orientando desativar (checagem `em_uso` por SQL explícito, FR-017).

## ALTERADOS

### `registrar_venda`
- **Antes**: `input.pagamentos: { cartao, dinheiro, pix, ministerio, vale }` (centavos).
- **Depois**: `input.pagamentos: { formaId: number, valorCentavos: number }[]` (só formas com valor > 0).
  - O backend valida que cada `formaId` existe e está **ativa**; soma e regra de troco (excedente ≤ valor na forma `dinheiro`) preservadas (FR-013).
- **Retorno**: `PedidoDto` (inalterado: `numero, totalCentavos, trocoCentavos, totalItens`).

### `relatorio_vendas`
- **Args**: `{ data, periodo }` (inalterado).
- **Retorno** (DTO dinâmico):
  - `resumo: { formas: { formaId, rotulo, totalCentavos }[], subtotalCentavos }` (ordenado por `ordem`).
  - `pedidos[].recebimentos: { formaId, chave, rotulo, valorCentavos }[]` (substitui `cartao/dinheiro/pix/ministerio/vale`).
  - Demais campos do pedido (numero, cliente, itens, totalCentavos, cancelado) inalterados.

## Bindings `src/lib/ipc.ts` (resumo)

- **Novos**: `estadoBoot()`, `listarFormas()`, `listarFormasAtivas()`, `criarForma(rotulo, ativa)`, `renomearForma(id, rotulo)`, `definirFormaAtiva(id, ativa)`, `reordenarFormas(ids)`, `excluirForma(id)`.
- **Alterados**: `registrarVenda(...)` passa `pagamentos` como lista; `ResumoVendas`/`PedidoRelatorio` viram dinâmicos. Remove `PagamentosInput { cartao, ... }` fixo.

## Notas de contrato

- Toda forma referenciada por **id** no payload de venda; a **chave** é o contrato estável para troco/legado e nunca trafega como editável.
- Rótulos exatos no seed: Crédito, Débito, Dinheiro, PIX, PIX Igreja, Ministério, Vale Presente (Princípio VI).
- **Falha da migração no boot (FR-016a)**: se a `m006` falhar (rollback executado), o setup do backend propaga o erro e o app **não abre para operação** — a UI consulta `estado_boot` e exibe mensagem clara (atualização falhou; nenhum dado perdido; procurar suporte antes de vender). Nenhum comando de venda/cadastro fica disponível nesse estado.

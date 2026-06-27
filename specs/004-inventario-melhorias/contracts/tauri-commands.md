# Phase 1 — Contratos (comandos Tauri `invoke`)

Camadas: UI (`src/lib/ipc.ts`) → comando Tauri (`commands_inventario.rs`) → caso de uso (`application::inventario`) → porta `InventarioRepo` (adapter SeaORM). Serialização `camelCase`.

## Novos

### `inventario_realizados() -> Vec<SessaoRealizada>`
Lista sessões **fechadas** e **canceladas** (mais recentes primeiro). Para a lista da área de inventário (FR-010).
```ts
interface SessaoRealizada {
  id: number; modo: "parcial" | "total"; rotulo: string | null;
  status: "fechada" | "cancelada"; abertaEm: string; fechadaEm: string | null;
}
```

### `inventario_relatorio(sessaoId: number) -> RelatorioSessao`
Detalhe só-leitura de uma sessão realizada (FR-011/012/014/015): agregados + itens + pendências vinculadas.
```ts
interface RelatorioSessao {
  sessao: SessaoRealizada;
  resumo: ResumoInventario;            // FR-012
  itens: Divergencia[];                // todos os itens contados (incl. diferença 0), do snapshot
  pendencias: Pendencia[];             // pendências da sessão (FR-015)
}
interface ResumoInventario {
  total: number; bateram: number; faltaram: number; sobraram: number; somaDiferencas: number;
}
// Divergencia já existe: { codigo, titulo, qtdSistema, qtdContada, diferenca }
```

### `reabrir_pendencia(pendenciaId: number) -> void`
Volta uma pendência resolvida para ativa (FR-007).

## Alterados

### `inventario_pendencias(apenasAbertas?: boolean) -> Pendencia[]`
Sem mudança de assinatura. UI passa a usar `false` para listar **resolvidas** (consulta/auditoria, FR-006) e `true` para a lista ativa.

### `inventario_bipar` / `inventario_desbipar` / `buscar_por_codigo_barras`
Busca passa a casar **somente `codigo`** (remoção de `codigo_barras`, FR-042). Assinaturas mantidas; parâmetro `codigoBarras` permanece como "valor lido" (é o `codigo`).

### Livro / `LivroDto`
Remove o campo `codigoBarras` de `salvar_livro`, `LivroDto` e tipos TS (FR-046). Opcional: expor `id` (leitura) no DTO.

## Inalterados (reuso)

- `resolver_pendencia(pendenciaId)` — é a ação **"Já resolvido"** (FR-002) e o passo final do **"Cadastrar livro"** (FR-003).
- `migrar_legado(...)` — permanece registrado; apenas sai da UI (FR-021).

## UI — "Cadastrar livro" a partir da pendência (FR-003)

Sem novo comando: a ação navega para o Cadastro semeando o campo `codigo` (via state de rota) e o id da pendência; ao salvar o livro com sucesso, a UI chama `resolver_pendencia(pendenciaId)`.

# Contrato — Operações no Supabase por caso de uso

Acesso via `supabase-js` (PostgREST), auth por usuário (JWT) + `apikey` publishable, **sem `service_role`**. RLS `to authenticated`. Toda escrita carimba `sync_uid` (cliente), `origem:"escritorio"`, `criado_por = auth.uid()`, `criado_em`/`atualizado_em` ISO. **Pai-antes-de-filho por `sync_uid`.** Derivados: saldo por `vw_saldo_livro`; custo por fold WASM.

## Leituras

| Tela | Operação |
|---|---|
| Pesquisa / Início | `from('livro').select(...)` + `from('vw_saldo_livro').select('*')`; custo via WASM sob demanda |
| Relatórios | `select` agregando `pedido`/`item_pedido`/`pagamento_pedido`/`movimento_estoque` por período |
| Fornecedores / Formas / Destinações | `select` das respectivas tabelas (não excluídos) |

## Escritas (idempotentes por `sync_uid`)

### Cadastro/preço de livro (LWW)
`from('livro').upsert(linha, { onConflict: 'sync_uid' })` com `atualizado_em = now`. Dedup por `codigo`.

### Nota de entrada (Lançamentos)
1. `insert lancamento_entrada` (sync_uid A)
2. `insert item_lancamento` (FK `lancamento_uid=A`, `livro_uid`)
3. `insert movimento_estoque` tipo `entrada` (FK `livro_uid`, `qtd>0`, `custo_unit_centavos`)

### Turno de operação (US4)
- **Abrir**: `insert turno_operacao` (sync_uid T, `operador_uid`, `status:'aberto'`, `abertura_em`, `caixa_inicial_centavos?`, `origem:'escritorio'`). Só um turno aberto por operador/origem por vez.
- **Ler turno aberto**: `from('turno_operacao').select().eq('operador_uid',…).eq('status','aberto')`.
- **Encerrar**: computar resumo (WASM `resumir_fechamento` sobre os `pagamento_pedido` do turno) + `encerrar(resumo, conferido)`; `update turno_operacao set status='encerrado', encerramento_em=now, resumo_json=…, atualizado_em=now`.

### Venda (checkout completo — US3, dentro de um turno)
1. **Exigir turno aberto** do operador (senão bloquear e orientar a abrir — FR-017).
2. Garantir **baseline** do(s) livro(s) (WASM `baseline_saldo_inicial`; inserir `saldo_inicial` se faltar).
3. `numero = proximo_numero(qtd_pedidos_do_turno)` (WASM); `insert pedido` (sync_uid P, `turno_uid=T`, `numero_no_turno=numero`) → `insert item_pedido[]` (FK `pedido_uid=P`) → `insert pagamento_pedido[]` (unique `(pedido_uid, forma_uid)`).
4. Para cada item: `baixa = clamp_baixa_venda(qtd, saldo_atual)` (WASM); `insert movimento_estoque` tipo `saida_venda` com `qtd = baixa`. Se `baixa < qtd`, **sinalizar** (toast/registro), sem bloquear.
5. Validar conclusão com `Pedido::validar_conclusao` (WASM) antes de gravar.

### Inventário (contagem na nuvem — US3)
- Sessão de contagem (digitação/câmera) → por livro: `diferenca_contagem`/`contagem_efetiva` (WASM) → `insert movimento_estoque` tipo `ajuste` com o delta. `resumir` para o fechamento.

### Destinações (006)
- `transferencia_destinacao` / `alocacao_venda` conforme `alocar_venda`/`alocar_perda`/`validar_transferencia` (WASM).

### Exclusões
- **Soft-delete**: `update ... set excluido_em = now` (nunca `delete`). Movimentos nunca são excluídos.

## Estado de conexão (FR-010)
- Antes de gravar, verificar conectividade/sessão; sem acesso → **bloquear escrita** e exibir "sem conexão". Leituras podem degradar para vazio com aviso.

## Convergência (FR-014, ADR-0016)
- Recursos mutáveis: overwrite só se `atualizado_em` recebido ≥ local (LWW por hora de servidor). Movimentos: união aditiva (sem conflito). Órfãos (FK/colisão de chave) isolados e reportados, não abortam a operação.

# Contrato — Ajuste de estoque (014)

## 1. Domínio (Rust, `livraria-domain`)

```text
estoque::validar_ajuste(saldo_atual: i64, delta: i64, motivo: &str) -> Result<i64, ErroDominio>
```

- `Ok(novo_saldo)` quando válido; erros e ordem conforme [data-model.md](../data-model.md).
- Novo erro: `ErroDominio::AjusteSemQuantidade` → código `AJUSTE_SEM_QUANTIDADE`,
  mensagem "informe a quantidade do ajuste (ex.: -2 ou 3)".

## 2. WASM (`@livraria/domain`)

```text
validar_ajuste_estoque(saldo_atual: number, delta: number, motivo: string)
  -> { ok: true, novoSaldo: number } | { ok: false, erro: "AJUSTE_SEM_QUANTIDADE" | "MOTIVO_OBRIGATORIO" | "ESTOQUE_NEGATIVO" }
```

Mesmo formato de `validar_conclusao_venda` (`ValidacaoOut`: `ok` + `erro` com o código estável;
erro de regra não lança exceção). A mensagem pt-BR é montada no escritório a partir do código.

## 3. Nuvem (Postgres, migração `0016`)

- Gatilho `trg_ajuste_sem_saldo_negativo` `BEFORE INSERT ON movimento_estoque FOR EACH ROW`, ativo só
  quando `new.tipo = 'ajuste' and new.origem = 'escritorio'`.
- Recusa: `raise exception 'ESTOQUE_NEGATIVO' using detail = '<saldo atual>'`, `errcode = 'P0001'`.
- Aceita: insert segue; o gatilho `trg_mov_republica_livro` (0012) continua republicando o saldo.
- Idempotente: `create or replace function` + `drop trigger if exists … ; create trigger …`.

## 4. Adapter do escritório (`apps/escritorio/lib/nuvem`)

```text
estoque.saldoLivro(livroUid: string): Promise<number>          // vw_saldo_livro; 0 se ausente
movimentos.registrarAjuste(livroUid, delta, motivo): Promise<{ error?: string }>
```

`registrarAjuste` mantém a assinatura atual; quando o Postgres devolve `ESTOQUE_NEGATIVO`, `error`
vira "O estoque ficaria negativo (atual: N)". Demais erros seguem a mensagem do servidor.

## 5. UI (`apps/escritorio/components`)

```text
<AjusteEstoque livroUid saldoAtual onAjustado />
```

- `saldoAtual: number` — usado na validação local via domínio antes de enviar.
- Fechado: botão "Ajustar estoque". Aberto: "Qtd (±)", "Motivo", "Cancelar", "Aplicar".
- "Aplicar" desabilitado enquanto envia. Sucesso: toast "Estoque ajustado", fecha e chama
  `onAjustado()`. Erro: toast com a mensagem, continua aberto com os valores.

```text
<LivroForm inicial onSalvo onCancelar />
```

- `inicial !== null` ("Alterar livro"): "Estoque atual" mostra `saldoLivro(...)` e o `AjusteEstoque`
  aparece junto; `onAjustado` só recarrega o saldo (não chama `onSalvo`, não reseta o formulário).
- `inicial === null` ("Novo livro"): sem `AjusteEstoque`; "Estoque inicial" como hoje.

# Quickstart — validação ponta-a-ponta da 013

Roteiro manual de aceite. Ordem importa: a nuvem primeiro, o app depois.

## 0. Nuvem (aplicar ANTES de publicar o app)

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/nuvem/migrations/0014_turno_maquina.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/nuvem/migrations/0015_turno_padrao_backfill.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/nuvem/tests/0015_turno_padrao_backfill.sql
```

⚠️ A 0014 precisa estar aplicada **antes** de um PDV atualizado subir um turno: o
push envia a coluna `maquina` e, sem ela lá, o upsert de `turno_operacao` falha e
o sync do turno para. Clientes antigos simplesmente não enviam o campo, então
aplicar cedo é seguro nos dois sentidos.

Conferência esperada da 0015: `OK 0015: backfill idempotente, zero pedidos sem
turno, venda com turno preservada.`

## 1. Atualizar com turno aberto

1. Com a versão anterior, abra um turno e registre 1 venda.
2. Atualize o app.
3. **Esperado**: o turno anterior (sem `maquina`) **não** é assumido por este PC —
   o operador abre um turno novo, e o antigo fica para o escritório fechar (US6).
   O cabeçalho da barra lateral mostra `PC · operador` do turno novo.

   ⚠️ Houve uma versão com adoção automática; foi removida. Qualquer cliente que
   sincronize com a mesma nuvem (inclusive uma máquina de desenvolvimento) recebe
   os turnos abertos da loja pela réplica e se apossaria deles — observado com o
   turno ATIVO de uma operadora. Nenhuma máquina assume turno que não abriu.

## 2. Venda exige turno (FR-002)

1. Encerre o turno.
2. Abra a tela de Venda.
3. **Esperado**: a interface de venda **não aparece** — surge o bloqueio com
   "Nenhum turno aberto" e o botão *Abrir turno*. Não é um aviso dispensável.
4. Abra o turno e registre uma venda: ela nasce como **Pedido Nº 1** do turno.

## 3. Numeração por turno (FR-016)

1. Registre 2 vendas (Nº 1 e 2), encerre o turno, abra outro e venda de novo.
2. **Esperado**: a primeira venda do novo turno é **Nº 1**. Confira que o número
   aparece igual na tela inicial, na lista do dia, no relatório e no PDF/Excel.
   (O `pedido.numero` global segue contínuo no banco — ele deixou de ser exibido.)

## 4. Cancelamento só do turno aberto (FR-003)

1. Na aba *Lista de vendas*, veja uma venda do turno **anterior**.
2. **Esperado**: os botões de reabrir/cancelar estão **desligados**, com a marca
   "de outro turno" e o motivo no tooltip. A venda do turno aberto cancela normal.

## 5. Fechamento pela nuvem (FR-019/FR-024)

1. Com um turno **aberto** no PDV e uma venda registrada **offline** (desligue a
   rede antes de vender), vá ao Escritório → **Turnos dos PDVs**.
2. Ache o turno pela máquina e clique em *Fechar turno*.
3. Religue a rede no PDV e aguarde o sync.
4. **Esperado**: o turno aparece encerrado no PDV, **a venda offline não se
   perde** — ela migra para um turno novo (ou para o aberto, se houver),
   renumerada a partir de 1. Log: `sync: N venda(s) migradas de turno fechado`.

## 6. Retenção de 45 dias (FR-007/008)

1. Em base de teste, crie um turno encerrado com data > 45 dias e já
   sincronizado (turno + vendas + itens + pagamentos com `sincronizado_em`).
2. Reinicie o app (ou aguarde um sync com novidade).
3. **Esperado**: o turno e todas as suas vendas somem do banco local — log
   `poda: 1 turno(s) antigos removidos (N linhas)`. Turno aberto, turno com
   pendência de sync e turno com ≤45 dias **permanecem**. `livro`,
   `saldo_publicado` e o razão de movimentos **não mudam**.
4. Nas telas de Relatórios e Lista de vendas, o seletor de data não deixa ir
   além de 45 dias e exibe "o histórico completo fica no escritório".

## 7. Suíte automatizada

```bash
cargo test --manifest-path src-tauri/Cargo.toml -- --test-threads=1
cargo test --manifest-path crates/livraria-domain/Cargo.toml
npm test && npm run build && npm run build -w apps/escritorio
scripts/check-file-size.sh
```

O WASM (`packages/domain`) é gerado pelo CI (`.github/workflows/wasm.yml`) — a
máquina de dev não compila wasm-pack (Smart App Control).

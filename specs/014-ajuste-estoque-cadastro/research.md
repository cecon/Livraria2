# Research — 014 Ajustar estoque a partir do cadastro do livro

Nenhum NEEDS CLARIFICATION ficou no Technical Context. As decisões abaixo saem do código atual
(`AjusteEstoque.tsx`, `movimentos.ts`, `vw_saldo_livro`, `estoque.rs`, migrações 0011/0012) e das
três respostas da clarificação.

## D1 — Onde mora a regra "sem saldo negativo"

- **Decision**: função pura `estoque::validar_ajuste(saldo_atual, delta, motivo) -> Result<i64,
  ErroDominio>` no `livraria-domain`, devolvendo o novo saldo. Erros: `AjusteSemQuantidade`
  (delta = 0), `MotivoObrigatorio` (motivo vazio/espaços), `EstoqueNegativo` (saldo + delta < 0).
  Exposta ao escritório como `validar_ajuste_estoque` no WASM.
- **Rationale**: Princípio I (regra no domínio, testável sem banco) e ADR-0022 (escritório não
  reimplementa regra). `EstoqueNegativo` e `MotivoObrigatorio` já existem com códigos estáveis.
- **Alternatives**: validar só em TS no componente (duplica regra fora do domínio); reusar
  `QuantidadeInvalida` para delta 0 (mensagem "mínimo 1" é errada para ajuste com sinal).

## D2 — Garantia contra concorrência na nuvem

- **Decision**: gatilho `BEFORE INSERT` em `movimento_estoque`, só quando `tipo = 'ajuste'`,
  `origem = 'escritorio'` **e** `referencia = 'ajuste_manual'`: trava a linha do livro
  (`select … for update`), soma os movimentos não excluídos e, se `saldo + new.qtd < 0`, aborta com
  `raise exception 'ESTOQUE_NEGATIVO'` e o saldo atual no `detail`. `registrarAjuste` passa a gravar
  `referencia = 'ajuste_manual'` (mesmo padrão do inventário, que grava `referencia = 'inventario'`).
  Migração `0016_ajuste_sem_saldo_negativo.sql`, idempotente.
- **Rationale**: a nuvem é a autoridade do estoque (ADR-0023); o insert do cliente continua igual
  (sem RPC nova); cobre Cadastro e Pesquisa de uma vez (FR-012). O marcador explícito limita a regra
  ao ajuste manual: o estorno de nota cancelada (`lancamentoCancelar`, também `tipo='ajuste'`,
  `origem='escritorio'`, sem `referencia`), movimentos históricos vindos por sync e os demais tipos
  (venda, contagem, entrada) não são afetados.
- **Concorrência (limite conhecido)**: a trava `for update` serializa **ajustes** concorrentes do
  mesmo livro. A baixa de venda na nuvem (0011) não usa essa trava, então uma venda simultânea ainda
  pode, em tese, levar o saldo abaixo de zero. Risco aceito: ajustes são raros (dezenas/mês) e a baixa
  de venda já é limitada ao saldo (ADR-0018). Mexer no gatilho de venda está fora do escopo.
- **Alternatives**: RPC `registrar_ajuste` (muda o contrato do adapter e duplica o insert —
  rejeitada por KISS); `CHECK` na view (não existe em view); só no cliente (corrida entre ajustes);
  filtrar pelo texto do `motivo` do estorno (frágil); fazer a baixa de venda usar a mesma trava
  (mexe no caminho crítico de venda — fora do escopo).
- **Achado lateral (fora do escopo)**: `lancamentoCancelar` não confere o erro de cada insert de
  estorno; uma falha deixaria a nota cancelada com estorno parcial. Registrado como follow-up.

## D3 — Exibir o estoque atual na tela "Alterar livro"

- **Decision**: `saldoLivro(livroUid)` em `lib/nuvem/estoque.ts`, lendo `vw_saldo_livro` filtrado por
  `livro_uid`; chamado ao abrir a tela e após cada ajuste.
- **Rationale**: mesma fonte da lista do Cadastro (`listarSaldos`) e da Pesquisa — SC-002 (mesmo
  número nas três telas). Reler o saldo da nuvem (e não somar na tela) atende o caso de venda
  concorrente.
- **Alternatives**: passar o saldo da lista para o formulário (fica velho e não se atualiza após o
  ajuste).

## D4 — Preservar edições não salvas do formulário

- **Decision**: o `AjusteEstoque` fica dentro do `LivroForm` com estado próprio; após o ajuste, só o
  estado `saldo` do formulário é recarregado — nada de `onSalvo`, remontagem ou recarga da lista.
- **Rationale**: FR-006/FR-007 — o ajuste é uma operação independente e já confirmada.
- **Alternatives**: salvar o livro junto com o ajuste (mistura duas operações e grava edição sem o
  usuário pedir).

## D5 — Envio duplicado e erro

- **Decision**: `AjusteEstoque` ganha estado `enviando`; o botão "Aplicar" fica desabilitado durante
  o envio. Em erro, o formulário continua aberto com os valores; a mensagem vem do mapeamento do
  código (`ESTOQUE_NEGATIVO` → "O estoque ficaria negativo (atual: N)").
- **Rationale**: FR-008/FR-009, sem lógica de idempotência no servidor (o `sync_uid` é gerado por
  clique; impedir o segundo clique basta). A quantidade só é aceita se o texto for um inteiro exato
  (`/^[+-]?\d+$/` após trim); "2,5" ou "-2abc" viram quantidade inválida. Quando a recusa vem da nuvem
  com `ESTOQUE_NEGATIVO`, o saldo do `detail` atualiza o "Estoque atual" (via `onSaldoAtualizado`).

## D6 — Tamanho do arquivo do Cadastro

- **Decision**: extrair `LivroForm` de `app/cadastro/page.tsx` (249 linhas) para
  `components/LivroForm.tsx` antes de adicionar o ajuste.
- **Rationale**: Princípio III (≤ 300 linhas significativas) e responsabilidade única.

## D7 — Distribuição do WASM

- **Decision**: o novo export entra no `livraria-domain-wasm`; o `packages/domain` é regenerado
  **só pelo CI** (`.github/workflows/wasm.yml`, disparado no push de mudanças em `crates/livraria-domain*`
  em qualquer branch), que commita o pacote de volta na branch.
- **Rationale**: a máquina de dev bloqueia `wasm-pack` (Smart App Control). Consequência: depois de
  T002–T004 é preciso **dar push e esperar o job** e fazer `git pull` antes de rodar o escritório com
  a função nova.

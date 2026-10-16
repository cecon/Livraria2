# Quickstart — validar a 014 (ajuste de estoque no Cadastro)

## Pré-requisitos

- Migração `apps/nuvem/migrations/0016_ajuste_sem_saldo_negativo.sql` aplicada em **homologação**
  (duas vezes, para provar idempotência), pelo mesmo processo das 0011–0015 (token no Notion).
- `@livraria/domain` regenerado com `validar_ajuste_estoque` (job de CI).
- Escritório rodando apontando para homologação e um usuário com acesso ao Cadastro.

## 1. Testes automáticos

```bash
cargo test -p livraria-domain
```

```bash
npm test
```

Em homologação, rodar `apps/nuvem/tests/0016_ajuste_sem_saldo_negativo.sql`: aceita ajuste positivo,
aceita ajuste que zera, recusa ajuste manual que deixaria negativo com `ESTOQUE_NEGATIVO`, ignora
estorno de nota (ajuste sem `referencia`), contagem e movimentos de outra origem.

## 2. Cenários manuais (spec US1/US2)

1. Cadastro → editar um livro com estoque 5: "Estoque atual" mostra **5** e há "Ajustar estoque".
2. Ajustar **−2**, motivo "quebra" → toast "Estoque ajustado"; tela mostra **3** sem sair.
3. Voltar à lista e abrir a Pesquisa do livro: ambos mostram **3**; extrato tem "Ajuste −2 · quebra".
4. Ajustar **−4** (estoque 3) → recusado com "O estoque ficaria negativo (atual: 3)"; formulário
   aberto com −4 e o motivo; estoque continua 3.
5. Ajustar **−3** → aceito; estoque **0**.
6. Editar o preço sem salvar, ajustar **+1** → preço digitado continua; o livro só muda ao clicar
   "Alterar". Cancelar a edição → ajuste continua no extrato.
7. "Novo livro" não tem "Ajustar estoque"; a lista do Cadastro não tem ação de ajuste.
8. Clique duplo em "Aplicar" → um único movimento no extrato.
9. Pesquisa: ajuste que deixaria negativo também é recusado.
10. Quantidade "2,5" ou "-2abc" → "Informe a quantidade (ex.: -2 ou 3)", nada registrado.
11. Nota de entrada finalizada com livros já vendidos → cancelar a nota funciona como antes (o estorno
    não é bloqueado pela regra nova).
12. Abrir "Alterar livro" (estoque 3), vender 2 no PDV e sincronizar, ajustar −2 → recusado pela
    nuvem com "atual: 1" e o "Estoque atual" da tela passa a mostrar 1.

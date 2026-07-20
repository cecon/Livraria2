# Feature Specification: Sincronização com a nuvem (escritório + PDV offline)

**Feature Branch**: `007-sincronizacao-nuvem`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "manter o escritório funcionando quando o notebook está desligado, mas chegou livro, e manter o notebook funcionando se não tiver internet no momento"

## User Scenarios & Testing *(mandatory)*

Dois papéis operam o sistema, cada um podendo estar indisponível para o outro:

- **Caixa (PDV)** — opera no notebook, **vende**, precisa funcionar **sem internet**.
- **Escritório (back-office)** — opera pela nuvem no navegador, **recebe livros** (entrada de estoque), **cadastra/edita livros e preços** e **consulta** relatórios, precisa funcionar **com o notebook desligado**.

O escritório **não vende**. Há **um único PDV**.

### User Story 1 - Escritório recebe livros com o notebook desligado (Priority: P1)

Chegou uma remessa de livros e o notebook do balcão está desligado. O operador do escritório abre a interface na nuvem e registra a entrada dos livros no estoque. Quando o notebook é ligado e há internet, o estoque dele passa a refletir essas entradas — sem ninguém redigitar nada.

**Why this priority**: É a dor central que motivou a feature: hoje o trabalho do escritório trava quando o notebook não está ligado.

**Independent Test**: Com o notebook desligado, registrar uma entrada de N exemplares pela nuvem; ligar o notebook com internet; confirmar que o estoque do livro subiu em N.

**Acceptance Scenarios**:

1. **Given** notebook desligado e livro com estoque 10, **When** o escritório registra entrada de 5 exemplares na nuvem, **Then** ao ligar o notebook com internet o estoque do livro passa a 15.
2. **Given** o escritório registrou várias entradas offline em relação ao PDV, **When** o notebook sincroniza, **Then** todas as entradas aparecem, uma única vez cada.

---

### User Story 2 - PDV vende sem internet e reconcilia depois (Priority: P1)

A internet caiu no balcão. O caixa continua vendendo normalmente no notebook. Quando a conexão volta, as vendas sobem para a nuvem e o escritório passa a enxergá-las e a ver o estoque reduzido.

**Why this priority**: A venda não pode parar por falta de internet — é a operação principal da livraria.

**Independent Test**: Desconectar a internet do notebook; realizar vendas; reconectar; confirmar que as vendas e as saídas de estoque aparecem na nuvem sem perda.

**Acceptance Scenarios**:

1. **Given** notebook sem internet, **When** o caixa realiza 3 vendas, **Then** as vendas são registradas e concluídas normalmente.
2. **Given** as 3 vendas feitas offline, **When** a internet volta, **Then** as 3 vendas e suas saídas de estoque aparecem na nuvem, uma única vez cada.

---

### User Story 3 - Estoque converge sem perda nem contagem dupla (Priority: P1)

Depois que os dois lados sincronizam, o estoque de cada livro é o mesmo no notebook e na nuvem, refletindo as entradas do escritório e as saídas das vendas — mesmo que a sincronização rode várias vezes ou seja interrompida no meio.

**Why this priority**: Sem convergência confiável, os números do estoque ficam errados e a feature perde o sentido. É requisito de correção, não conveniência.

**Independent Test**: Gerar entradas na nuvem e vendas no PDV para o mesmo livro; sincronizar; conferir que o estoque bate dos dois lados; sincronizar de novo e confirmar que nada muda.

**Acceptance Scenarios**:

1. **Given** entrada de 5 no escritório e saída de 2 no PDV para o mesmo livro (estoque inicial 10), **When** ambos sincronizam, **Then** o estoque é 13 no notebook e 13 na nuvem.
2. **Given** uma sincronização já concluída, **When** a sincronização é executada novamente, **Then** o estoque permanece idêntico e nenhum movimento é duplicado.
3. **Given** uma sincronização interrompida por queda de conexão, **When** ela é retomada, **Then** o resultado final é o mesmo de uma sincronização não interrompida.

---

### User Story 4 - Cadastro e preço editáveis nos dois lados (Priority: P2)

O mesmo livro pode ter cadastro ou preço ajustado tanto no escritório quanto no notebook. Após sincronizar, os dois lados mostram a versão mais recente; a operação nunca fica bloqueada por causa disso.

**Why this priority**: Necessário para o back-office funcionar, mas menos crítico que estoque e vendas; edições de cadastro são menos frequentes.

**Independent Test**: Editar o preço de um livro no escritório e (separadamente) no notebook; sincronizar; confirmar que ambos mostram a última edição, sem erro.

**Acceptance Scenarios**:

1. **Given** o preço de um livro editado no escritório às 10h e no notebook às 11h, **When** ambos sincronizam, **Then** os dois lados mostram o preço da edição das 11h.
2. **Given** um livro cadastrado só no escritório, **When** o notebook sincroniza, **Then** o livro passa a existir no notebook.

---

### User Story 5 - Escritório consulta estoque e vendas atualizados (Priority: P2)

O operador do escritório consulta, pela nuvem, o estoque atual e as vendas já sincronizadas, para conferência e relatórios, sem depender de acesso físico ao notebook.

**Why this priority**: Entrega valor de visibilidade remota, mas depende das histórias P1 estarem prontas.

**Independent Test**: Após o PDV sincronizar vendas, abrir a consulta na nuvem e conferir que os números refletem as vendas sincronizadas.

**Acceptance Scenarios**:

1. **Given** vendas sincronizadas pelo PDV, **When** o escritório abre a consulta de vendas, **Then** vê essas vendas com valores corretos.

---

### User Story 6 - Sincronização automática e transparente (Priority: P3)

A sincronização acontece sozinha em segundo plano sempre que há internet, sem o operador precisar apertar botão. O sistema mostra se os dados estão sincronizados, pendentes ou sem conexão.

**Why this priority**: Melhora muito a experiência e reduz erro humano, mas o valor essencial já é entregue com sincronização mesmo que manual.

**Independent Test**: Com internet disponível, gerar um movimento e, sem nenhuma ação manual, confirmar que em pouco tempo o indicador muda para "sincronizado".

**Acceptance Scenarios**:

1. **Given** internet disponível e um movimento novo, **When** nenhum comando manual é dado, **Then** o dado sincroniza em segundo plano e o indicador mostra "sincronizado".
2. **Given** sem internet, **When** o operador gera um movimento, **Then** o indicador mostra "pendente" e a operação conclui normalmente.

---

### Edge Cases

- Notebook offline por vários dias acumulando muitas vendas → ao reconectar, todas sincronizam sem perda e sem duplicação.
- Mesmo livro com cadastro/preço editado nos dois lados antes de sincronizar → prevalece a última edição, sem perda silenciosa e sem travar.
- Sincronização interrompida no meio (queda de conexão, notebook desligado) → retomável, sem duplicar o que já subiu.
- Movimento ou venda que referencia um livro inexistente (inconsistência histórica preexistente) → o item problemático é isolado e reportado, **sem interromper** o restante da sincronização.
- Relógios do notebook e da nuvem dessincronizados → a decisão de "última edição vence" e a ordem de sincronização usam uma referência de tempo confiável, não o relógio local do caixa.
- Um livro removido em um lado → não "ressuscita" após a sincronização.
- Uma saída de venda que chega antes da entrada correspondente (ordem de sincronização) → o estoque final permanece correto, pois é a soma de todos os movimentos, independente da ordem.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir que o escritório registre entradas de livros (recebimento) pela nuvem enquanto o notebook está desligado ou offline.
- **FR-002**: O PDV MUST continuar registrando vendas e movimentos de estoque normalmente sem conexão com a internet.
- **FR-003**: O sistema MUST sincronizar, quando houver conexão, os movimentos de estoque (entradas do escritório e saídas do PDV) entre o PDV e a nuvem, em ambos os sentidos.
- **FR-004**: A sincronização MUST ser idempotente — executá-la novamente, qualquer número de vezes, não altera o estado final nem duplica registros.
- **FR-005**: O estoque de cada livro MUST ser derivado dos movimentos e, após a sincronização de ambos os lados, MUST ser idêntico no PDV e na nuvem.
- **FR-006**: O sistema MUST preservar todos os movimentos e vendas gerados offline — nenhum registro pode ser perdido por ausência de conexão no momento em que ocorreu.
- **FR-007**: O sistema MUST permitir que o escritório cadastre e edite livros e preços pela nuvem.
- **FR-008**: Quando o cadastro ou preço do mesmo livro for alterado nos dois lados, o sistema MUST convergir para a última alteração (por referência de tempo confiável) sem bloquear a operação de nenhum lado.
- **FR-009**: O escritório MUST conseguir consultar estoque e vendas atualizados conforme os dados já sincronizados.
- **FR-010**: A sincronização MUST ser retomável — após interrupção, continua e conclui sem duplicar o que já havia sido sincronizado.
- **FR-011**: O sistema MUST mesclar movimentos independentemente da ordem em que chegam, mantendo o total de estoque correto.
- **FR-012**: O sistema MUST tolerar dados inconsistentes preexistentes (ex.: movimento referenciando livro ausente) isolando e reportando o item afetado, sem interromper a sincronização dos demais.
- **FR-013**: O acesso à base na nuvem MUST ser autenticado e restrito; nenhuma credencial de acesso pode ficar exposta no aplicativo distribuído.
- **FR-014**: O sistema MUST indicar ao operador o estado de sincronização (ex.: sincronizado, pendente, sem conexão).
- **FR-015**: Uma exclusão feita em um lado MUST propagar para o outro, sem que o item excluído reapareça após a sincronização.
- **FR-016**: A sincronização SHOULD ocorrer automaticamente quando houver conexão, sem exigir ação manual, mantendo também a opção de disparo manual.

### Key Entities *(include if feature involves data)*

- **Movimento de estoque**: evento **imutável** que registra uma mudança de estoque (tipos: saldo inicial, entrada, saída de venda, ajuste, contagem, estorno). Tem identidade estável, quantidade, custo, referência ao livro, origem (PDV ou escritório) e momento. É a **fonte da verdade** do estoque — o saldo é sempre a soma dos movimentos.
- **Livro**: cadastro do produto (título, código de barras, preço). Estado **mutável**, editável tanto no PDV quanto no escritório.
- **Venda**: registro de uma venda no PDV; gera os movimentos de saída correspondentes.
- **Recebimento (entrada de fornecedor)**: registro feito no escritório; gera os movimentos de entrada correspondentes.
- **Origem / Estação**: identifica onde um dado foi criado (PDV ou escritório), permitindo distinguir e mesclar.
- **Estado de sincronização**: controle do que já foi sincronizado e do que está pendente em cada lado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O escritório consegue registrar a chegada de livros em 100% das tentativas mesmo com o notebook desligado.
- **SC-002**: O PDV opera e registra vendas offline por pelo menos um dia inteiro de operação e, ao reconectar, sincroniza todos os registros sem perder nenhum.
- **SC-003**: Após ambos os lados sincronizarem, o estoque de cada livro é idêntico no PDV e na nuvem em 100% dos casos — zero contagem dupla e zero perda de movimento.
- **SC-004**: Executar a sincronização repetidamente não altera o estoque nem cria registros duplicados (resultado estável).
- **SC-005**: Uma sincronização de rotina, com o volume típico de um dia de operação, conclui em menos de 1 minuto com conexão comum.
- **SC-006**: Nenhuma credencial de acesso à nuvem fica recuperável a partir do aplicativo distribuído.
- **SC-007**: O operador identifica em poucos segundos se seus dados estão sincronizados ou pendentes.

## Assumptions

- O estoque já é derivado de uma **razão de movimentos** no domínio (confirmado — `domain/estoque.rs`, ADR-0008/0009). Assim, entradas (escritório) e saídas (PDV) são eventos append-only que se mesclam **sem conflito**, e o saldo é sempre recalculável.
- Existe **um único PDV**. Múltiplos PDVs vendendo em paralelo estão **fora de escopo** nesta feature.
- O escritório opera **sempre online** (é a interface na nuvem) e não precisa de modo offline próprio; apenas o PDV precisa operar sem internet.
- A **nuvem é o ponto de encontro** (hub) dos dados mesclados; o PDV mantém uma cópia local para operar offline e sincroniza as diferenças.
- **Consistência eventual** é aceitável — não é necessário sincronizar em tempo real; latência de segundos a minutos é suficiente.
- O **único recurso mutável compartilhado** é o cadastro/preço do Livro; para ele vale "última edição vence". Estoque nunca é escrito como número — só como movimentos.
- Deleções são raras e podem ser tratadas por **marcação** (soft delete) em vez de remoção física, para propagarem de forma consistente.
- O volume de dados é de uma **livraria pequena** (milhares de registros), não exige escala de milhões.
- A interface do escritório pode **reaproveitar** os fluxos de recebimento (feature 003) e de movimentos de estoque (feature 002).

## Dependencies

- Requer uma **base de dados na nuvem** acessível e autenticada, já provisionada (credenciais registradas na Memória do Projeto, no Notion — fora do repositório).
- Requer **conectividade intermitente**; o sistema **não** exige conexão contínua em nenhum dos lados.
- Depende do modelo de **movimentos de estoque** já existente (feature 002) e do fluxo de **recebimento de fornecedores** (feature 003).

## Out of Scope

- Registrar **vendas pela nuvem** (o escritório não é um PDV).
- **Múltiplos PDVs** vendendo simultaneamente e convergindo entre si.
- Sincronização em **tempo real** / colaboração ao vivo.
- Modo **offline no escritório** (a interface do escritório pressupõe internet).

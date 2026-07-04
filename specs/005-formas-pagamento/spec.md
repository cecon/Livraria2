# Feature Specification: Cadastro de formas de pagamento (Crédito, Débito, PIX Igreja)

**Feature Branch**: `005-formas-pagamento`

**Created**: 2026-06-27

**Status**: Draft

**Input**: User description: "vamos adicionar 2 formas de pagamentos novas a DEBITO e PIX IGREJA, a forma atual chamada cartao vai virar CREDITO. acho melhor criar um cadastro de formas de pagamento, assim ficamos mais livres para trabalhar, mas precisará revisitar todas as tabelas existentes para fazer os devidos vínculos sem prejuízo de dados"

## Clarifications

### Session 2026-07-03

- Q: Se a migração falhar na verificação anti-perda (rollback executado), o que o app deve fazer ao abrir? → A: Bloquear a abertura para operação, com mensagem clara de que a atualização falhou, que nenhum dado foi perdido (rollback) e que é preciso resolver antes de vender.
- Q: Como comparar nomes para impedir formas ativas duplicadas (FR-010)? → A: Comparação insensível a caixa e acentos, com espaços das pontas ignorados ("credito" = "Crédito" = " CRÉDITO ").
- Q: Ao reativar uma forma inativa cujo nome conflita com uma forma ativa, o que fazer? → A: Bloquear a reativação com mensagem clara pedindo para renomear uma das duas antes; sem renome automático.

### Session 2026-06-27

- Q: Com cadastro editável, como evitar que excluir/desativar formas quebre o troco e o mapeamento do legado? → A: Formas "de sistema" com chave estável — Dinheiro (troco) + alvos do legado (Crédito, PIX, Ministério, Vale) não podem ser excluídas nem desativadas; podem ser renomeadas/reordenadas. Débito, PIX Igreja e futuras são totalmente livres.
- Q: As novas formas (Débito, PIX Igreja) nascem ativas na atualização ou só após ativação manual? → A: As 7 formas nascem ativas; Débito e PIX Igreja aparecem no PDV imediatamente após a atualização.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar venda com as novas formas de pagamento (Priority: P1)

No PDV, o operador conclui uma venda distribuindo o valor entre as formas de pagamento ativas. Hoje há "Cartão"; a partir de agora ele vê **Crédito**, **Débito**, **Dinheiro**, **PIX**, **PIX Igreja**, **Ministério** e **Vale Presente**, e pode lançar o valor recebido em cada uma (uma venda pode dividir entre várias formas, como hoje).

**Why this priority**: É o motivo direto do pedido — separar Crédito/Débito e registrar o PIX da igreja afeta toda venda do dia a dia. Sem isso, a feature não entrega valor.

**Independent Test**: Abrir o PDV, montar uma venda e confirmar que as 7 formas ativas aparecem na ordem definida; lançar valores em Crédito + Débito + PIX Igreja, fechar a venda e conferir que o recebido por forma foi gravado corretamente e bate com o total.

**Acceptance Scenarios**:

1. **Given** o PDV aberto com um item na venda, **When** o operador abre as formas de pagamento, **Then** vê "Crédito" no lugar do antigo "Cartão", além de "Débito" e "PIX Igreja" entre as opções, todas na ordem cadastrada.
2. **Given** uma venda de R$ 100,00, **When** o operador lança R$ 60,00 em Crédito e R$ 40,00 em Débito, **Then** a venda fecha como paga e o recebido por forma é registrado separadamente.
3. **Given** uma venda em aberto, **When** o operador tenta concluir com a soma das formas diferente do total, **Then** o sistema impede ou sinaliza a divergência exatamente como faz hoje (regra de fechamento inalterada).
4. **Given** uma forma desativada no cadastro, **When** o operador abre o PDV, **Then** essa forma não aparece como opção de recebimento.

---

### User Story 2 - Gerenciar o cadastro de formas de pagamento (Priority: P2)

Um responsável acessa uma tela de **cadastro de formas de pagamento** e pode criar uma nova forma, renomear, reordenar e ativar/desativar formas existentes — sem precisar de alteração de código. Formas já usadas em vendas não podem ser excluídas (apenas desativadas), preservando o histórico.

**Why this priority**: É o que dá a liberdade pedida ("assim ficamos mais livres para trabalhar"). Depende da fundação de dados (US3) estar pronta, mas entrega autonomia ao usuário. Sem a US1 a feature já tem valor; a US2 amplia.

**Independent Test**: Abrir o cadastro, criar a forma "Boleto", reordená-la, desativá-la, e confirmar que aparece/desaparece no PDV conforme o estado ativo — e que tentar excluir uma forma já usada em venda é bloqueado com mensagem clara.

**Acceptance Scenarios**:

1. **Given** o cadastro de formas aberto, **When** o responsável cria uma forma com nome novo e a marca como ativa, **Then** ela passa a aparecer no PDV na posição definida.
2. **Given** uma forma sem nenhuma venda vinculada, **When** o responsável a exclui, **Then** ela é removida do cadastro.
3. **Given** uma forma já usada em pelo menos uma venda, **When** o responsável tenta excluí-la, **Then** o sistema bloqueia a exclusão e oferece desativar no lugar.
4. **Given** duas formas ativas, **When** o responsável troca a ordem entre elas, **Then** a nova ordem reflete no PDV e nos relatórios.
5. **Given** o responsável renomeia "Crédito" para "Cartão de Crédito", **When** ele salva, **Then** o novo rótulo aparece em vendas novas e nas existentes (mesma identidade, rótulo atualizado).

---

### User Story 3 - Migrar dados existentes sem prejuízo (Priority: P1)

Ao atualizar o sistema, todas as vendas já registradas continuam íntegras: os valores antes guardados como "Cartão" passam a ser reconhecidos como **Crédito** (mesma identidade, renomeada), e Dinheiro, PIX, Ministério e Vale Presente seguem vinculados às suas formas. Nenhum valor recebido é perdido, alterado ou somado em dobro. Relatórios de períodos anteriores continuam batendo com os mesmos totais de antes.

**Why this priority**: É pré-requisito técnico e a maior fonte de risco. O usuário foi explícito: "revisitar todas as tabelas existentes para fazer os devidos vínculos sem prejuízo de dados". Sem isso, a mudança corromperia o histórico financeiro.

**Independent Test**: Sobre uma base com vendas reais (incluindo as importadas do legado), aplicar a atualização e comparar, para cada venda e para os totais por período, o recebido por forma antes e depois — o total geral e o de cada forma preexistente devem ser idênticos, com os antigos valores de "Cartão" agora atribuídos a "Crédito".

**Acceptance Scenarios**:

1. **Given** uma base com vendas que tinham valores em "Cartão", **When** a atualização é aplicada, **Then** esses valores aparecem como "Crédito" e a soma por venda permanece igual à de antes.
2. **Given** vendas com Dinheiro, PIX, Ministério e Vale Presente, **When** a atualização é aplicada, **Then** cada valor permanece vinculado à forma correspondente, sem perda nem duplicação.
3. **Given** a base já migrada, **When** a atualização é aplicada novamente (reabertura do app), **Then** nada é duplicado nem alterado (operação idempotente).
4. **Given** o relatório de um período anterior à atualização, **When** ele é gerado depois da migração, **Then** o total geral e o total de cada forma preexistente são iguais aos de antes (com "Cartão" agora rotulado "Crédito").

---

### Edge Cases

- **Forma desativada com histórico**: vendas antigas pagas com uma forma agora desativada continuam exibindo e somando corretamente essa forma em relatórios; ela só some das *opções* de novo recebimento.
- **Exclusão x desativação**: excluir só é permitido para formas não-de-sistema nunca usadas; o sistema deve distinguir os casos (de sistema / já usada / livre) com mensagem clara (a memória do projeto registra que FKs não são enforced em runtime — a checagem de uso precisa ser explícita, não confiar no banco).
- **Nomes duplicados**: o cadastro deve impedir duas formas ativas com o mesmo nome (comparação insensível a caixa/acentos, espaços aparados — FR-010) para não confundir PDV e relatórios; a mesma regra bloqueia a **reativação** de uma forma inativa com nome conflitante (FR-007).
- **Nenhuma forma ativa**: o sistema deve evitar deixar zero formas ativas (o PDV ficaria sem como receber).
- **Troco**: a regra atual de que o troco só sai do Dinheiro permanece — a forma "Dinheiro" é de sistema e identificada pela chave estável, então renomeá-la não quebra o troco e ela não pode ser excluída/desativada.
- **Mapeamento do legado**: a importação do legado (códigos `vdmetodo` / colunas `vdcartao`, `vdpix`, etc.) deve continuar caindo nas formas corretas, com "cartão de crédito" do legado mapeado para a forma Crédito.
- **Reordenação**: mudar a ordem não pode alterar valores históricos, apenas a apresentação.
- **Falha na migração**: se a verificação anti-perda divergir, a migração é revertida (rollback) e o app bloqueia a abertura com mensagem clara (nenhum dado perdido; operação suspensa até resolver) — ver FR-016a.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST manter um cadastro de formas de pagamento como dado gerenciável (não mais uma lista fixa em código), com pelo menos: nome/rótulo, situação (ativa/inativa), ordem de exibição e uma **chave estável** que identifica a forma independentemente do rótulo.
- **FR-001a**: O sistema MUST distinguir **formas "de sistema"** — aquelas das quais o comportamento depende: **Dinheiro** (troco) e os alvos do mapeamento do legado (**Crédito, PIX, Ministério, Vale Presente**). Formas de sistema NÃO podem ser excluídas nem desativadas; PODEM ser renomeadas e reordenadas (o comportamento se prende à chave estável, não ao rótulo). **Débito**, **PIX Igreja** e quaisquer formas criadas pelo usuário são livres (podem ser excluídas/desativadas conforme as demais regras).
- **FR-002**: O cadastro MUST ser semeado, na primeira aplicação da mudança, com as 7 formas **todas ativas**: **Crédito**, **Débito**, **Dinheiro**, **PIX**, **PIX Igreja**, **Ministério** e **Vale Presente** — de modo que Débito e PIX Igreja apareçam no PDV imediatamente após a atualização, sem passo manual de ativação.
- **FR-003**: A forma hoje chamada "Cartão" MUST passar a se chamar "Crédito" mantendo a **mesma identidade** — todos os valores históricos antes atribuídos a "Cartão" passam a pertencer a "Crédito", sem reclassificação manual.
- **FR-004**: As formas **Débito** e **PIX Igreja** MUST ser adicionadas como novas, sem alterar nem mesclar nenhuma das formas existentes (Dinheiro, PIX, Ministério, Vale Presente permanecem).
- **FR-005**: Usuários MUST poder criar uma nova forma de pagamento pela aplicação, informando nome e situação inicial.
- **FR-006**: Usuários MUST poder renomear uma forma existente; o novo rótulo passa a valer para vendas novas e para a exibição das existentes (a identidade da forma não muda).
- **FR-007**: Usuários MUST poder ativar e desativar uma forma **não-de-sistema**. Formas inativas não aparecem como opção de recebimento no PDV, mas continuam válidas em registros e relatórios históricos. Formas de sistema (FR-001a) não podem ser desativadas. Reativar uma forma cujo nome conflita com uma forma ativa (regra de comparação do FR-010) MUST ser bloqueado com mensagem clara orientando renomear uma das duas antes — sem renome automático.
- **FR-008**: Usuários MUST poder definir/alterar a ordem de exibição das formas, refletida no PDV e nos relatórios.
- **FR-009**: O sistema MUST impedir a exclusão de uma forma que já tenha sido usada em qualquer venda **ou que seja de sistema** (FR-001a), oferecendo desativação como alternativa quando aplicável; formas não-de-sistema nunca usadas PODEM ser excluídas.
- **FR-010**: O sistema MUST impedir o cadastro de duas formas ativas com o mesmo nome, comparando de forma **insensível a caixa e acentos** e ignorando espaços nas pontas ("credito" = "Crédito" = " CRÉDITO ").
- **FR-011**: O sistema MUST garantir que sempre haja ao menos uma forma ativa.
- **FR-012**: O PDV MUST listar dinamicamente as formas ativas, na ordem cadastrada, permitindo dividir o valor de uma venda entre múltiplas formas (comportamento atual preservado).
- **FR-013**: A regra de fechamento da venda (soma das formas deve igualar o total; troco somente em Dinheiro) MUST permanecer inalterada em comportamento. O troco é amarrado à **forma de sistema "Dinheiro"** (pela chave estável, FR-001a), não ao rótulo exibido.
- **FR-014**: O recebido por forma de cada venda MUST ser persistido vinculado à forma de pagamento do cadastro, de modo que renomear ou reordenar formas não altere valores já registrados.
- **FR-015**: A atualização MUST re-vincular todos os dados existentes (vendas/pedidos e quaisquer outras tabelas que hoje referenciem forma de pagamento) ao novo cadastro **sem perda, alteração ou duplicação** de valores.
- **FR-016**: A re-vinculação dos dados existentes MUST ser idempotente: aplicar a atualização mais de uma vez não duplica nem corrompe registros.
- **FR-016a**: Se a re-vinculação falhar na verificação anti-perda, o sistema MUST reverter integralmente a migração (rollback, dados originais intactos) e **bloquear a abertura do app para operação**, exibindo mensagem clara de que a atualização dos dados falhou, que nenhum valor foi perdido e que é necessário resolver o problema antes de registrar vendas. O app NÃO deve operar em estado parcialmente migrado nem em modo degradado.
- **FR-017**: A checagem de "forma já usada" (FR-009) MUST ser explícita sobre os dados, não dependendo de integridade referencial do banco em runtime (ver memória do projeto: FKs não enforced → risco de órfãs).
- **FR-018**: A importação de vendas do legado MUST continuar mapeando os métodos legados para as formas corretas do cadastro **pela chave estável** (FR-001a), com o cartão de crédito do legado mapeado para **Crédito** e o default para **Dinheiro**. Como esses alvos são formas de sistema, o mapeamento nunca fica órfão.
- **FR-019**: Os relatórios (por período/turno e consolidados) MUST apresentar os totais por forma de pagamento de forma dinâmica conforme o cadastro, mantendo o total geral igual à soma de todas as formas.
- **FR-020**: Relatórios de períodos anteriores à atualização MUST produzir os mesmos totais por forma e total geral de antes (com "Cartão" exibido como "Crédito").

### Key Entities *(include if feature involves data)*

- **Forma de Pagamento (cadastro)**: representa um meio de recebimento gerenciável pelo usuário. Atributos: identidade/**chave estável** (não muda ao renomear), nome/rótulo exibido, situação (ativa/inativa), ordem de exibição, marcador **de sistema** (FR-001a — Dinheiro/Crédito/PIX/Ministério/Vale Presente), e indicação de uso histórico (se já foi usada em alguma venda — relevante para excluir vs desativar). Conjunto inicial semeado: Crédito, Débito, Dinheiro, PIX, PIX Igreja, Ministério, Vale Presente.
- **Recebimento da venda (valor por forma)**: o valor recebido em uma venda atribuído a uma forma de pagamento específica. Relaciona Venda/Pedido ↔ Forma de Pagamento com um valor em dinheiro. Substitui as colunas fixas atuais (Cartão/Dinheiro/PIX/Ministério/Vale) por um vínculo ao cadastro, preservando os valores históricos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Após a atualização, o operador consegue registrar uma venda dividida entre Crédito, Débito e PIX Igreja em um único fluxo de PDV, sem passos extras em relação a hoje.
- **SC-002**: 100% das vendas preexistentes mantêm, após a migração, o mesmo total geral e o mesmo valor por forma de antes (valores de "Cartão" agora atribuídos a "Crédito") — verificável por comparação antes/depois.
- **SC-003**: Reaplicar a atualização (reabrir o app) não altera nenhuma venda nem total (zero duplicações), comprovável repetindo a verificação de SC-002.
- **SC-004**: Um responsável consegue criar, renomear, reordenar e desativar uma forma de pagamento pela aplicação e ver o efeito no PDV em menos de 1 minuto, sem suporte técnico.
- **SC-005**: Tentar excluir uma forma já usada em venda é bloqueado em 100% dos casos, com orientação para desativar.
- **SC-006**: Relatórios de qualquer período anterior à atualização exibem total geral idêntico ao de antes da mudança.

## Assumptions

- **Rename em lugar (Cartão → Crédito)**: o pedido "a forma atual chamada cartao vai virar CREDITO" é interpretado como renomear a mesma forma (mesma identidade), de modo que o histórico de cartão passa a contar como Crédito. Não se cria uma forma "Crédito" separada deixando "Cartão" como legado.
- **Conjunto final de 7 formas** confirmado com o usuário: Crédito (ex-Cartão), Débito (nova), Dinheiro, PIX, PIX Igreja (nova), Ministério, Vale Presente; nenhuma existente é removida ou mesclada.
- **Cadastro com CRUD completo na UI** confirmado com o usuário: criar, renomear, reordenar e ativar/desativar; exclusão apenas para formas nunca usadas.
- **"PIX Igreja" é distinto de "Ministério" e de "PIX"** — coexistem como três formas independentes.
- **Sem TEF/integração fiscal**: as formas de pagamento seguem sendo apenas registro gerencial (como hoje), sem captura de cartão, conciliação bancária ou validação externa.
- **Regra do troco**: permanece "troco só do Dinheiro"; assume-se que a forma "Dinheiro" continua identificável pelo sistema mesmo com cadastro flexível.
- **Escopo offline / mono-estação**: mantém-se o contexto desktop atual; o cadastro é local, sem sincronização externa.
- **Sem novas permissões/papéis**: assume-se o modelo de acesso atual do app (não há introdução de perfis de usuário só para esta tela), salvo orientação posterior.

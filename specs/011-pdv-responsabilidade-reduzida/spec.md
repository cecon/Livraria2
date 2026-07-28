# Feature Specification: PDV com Responsabilidade Reduzida

**Feature Branch**: `[011-pdv-responsabilidade-reduzida]`

**Created**: 2026-07-28

**Status**: Draft

**Input**: User description: "preciso transformar o pdv offline first em menos responsabilidade, tipo, nao cadastramos mais nada exceto vendas, abrir turno fechar turno localmente, e o resto tudo ficara na nuvem, a respopnsabilidade do estoque e a primeira coisa a ser atacada certo, assim os produtos poderiam desce com um saldo simples para aparecer no pdv mas o controle contabil de fato ocorre na nuvem. Antes de mexer no PDV, precisamos olhar para produção e profissionalizar o estoque na nuvem com regras corretas: ao receber uma venda e ao cancelar uma venda, o estoque oficial acontece automaticamente. O PDV conta apenas com saldo local simples: saldo publicado do cadastro de produto menos vendas não sincronizadas mais vendas canceladas não sincronizadas."

## Clarifications

### Session 2026-07-28

- Q: Quando uma venda chega à nuvem e o saldo oficial não cobre a quantidade, qual comportamento contábil deve prevalecer? → A: Baixar a quantidade vendida inteira, mesmo se o saldo ficar negativo, e gerar divergência para conferência.
- Q: Ao cancelar uma venda já incorporada ao estoque oficial, qual quantidade deve ser estornada? → A: Estornar exatamente os movimentos oficiais gerados pela venda original.
- Q: Quando a nuvem deve considerar uma venda pronta para gerar baixa oficial de estoque? → A: Processar somente quando a venda estiver marcada como completa/pronta.
- Q: Como tratar venda com produto inexistente na nuvem? → A: Não deve existir venda com produto inexistente; toda venda válida referencia produto conhecido/publicado.
- Q: Como tratar o estoque atual em produção ao ativar a automação oficial? → A: Preservar o estoque atual em produção como saldo de partida; não reprocessar histórico para alterar saldos atuais.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Profissionalizar Estoque Oficial na Nuvem (Priority: P1)

A gestão da livraria precisa que a produção tenha uma regra central e confiável de estoque oficial: quando uma venda é recebida pela nuvem, o estoque oficial baixa; quando uma venda é cancelada, o estoque oficial estorna; e nenhuma aplicação precisa gravar manualmente a baixa de estoque da venda.

**Why this priority**: Antes de reduzir a responsabilidade do PDV, é necessário garantir que a nuvem consiga ser a fonte contábil correta. Sem isso, simplificar o PDV apenas desloca o problema.

**Independent Test**: Pode ser testado em ambiente equivalente à produção registrando uma venda com itens, verificando que os movimentos oficiais de saída são gerados uma única vez, cancelando a venda e verificando que os movimentos oficiais de estorno são gerados uma única vez.

**Acceptance Scenarios**:

1. **Given** uma venda válida chega à nuvem com seus itens, **When** a venda fica disponível para processamento oficial, **Then** o estoque oficial registra a saída de cada item vendido sem exigir lançamento manual de movimento.
2. **Given** a mesma venda é reenviada ou reprocessada, **When** a nuvem avalia a venda novamente, **Then** o estoque oficial não duplica saídas, pagamentos ou totais.
3. **Given** uma venda já incorporada ao estoque oficial é cancelada, **When** o cancelamento é confirmado, **Then** o estoque oficial registra o estorno correspondente sem duplicar devoluções se o cancelamento for repetido.
4. **Given** uma venda tem produto inativo ou saldo oficial insuficiente, **When** a nuvem processa a venda, **Then** a ocorrência fica visível para conferência administrativa sem apagar a venda recebida.
5. **Given** uma venda válida tem quantidade maior que o saldo oficial disponível, **When** a nuvem processa a venda, **Then** o estoque oficial baixa a quantidade integral vendida, mesmo que o saldo fique negativo, e gera divergência para conferência.
6. **Given** apenas parte dos dados de uma venda chegou à nuvem, **When** a venda ainda não está marcada como completa/pronta, **Then** o estoque oficial não gera baixa até a conclusão explícita da venda.
7. **Given** a automação oficial de estoque será ativada em produção, **When** o processo de implantação começa, **Then** o estoque atual de produção é preservado como saldo de partida e não é recalculado por reprocessamento histórico.

---

### User Story 2 - Vender Offline com Turno Local (Priority: P2)

O operador do balcão precisa abrir um turno no PDV, realizar vendas mesmo sem internet e fechar o turno localmente, sem depender de cadastro, ajuste de estoque ou outras rotinas administrativas no caixa.

**Why this priority**: Este é o valor mínimo do PDV: manter a venda funcionando no balcão com simplicidade e resiliência, mesmo quando a nuvem estiver indisponível.

**Independent Test**: Pode ser testado colocando o PDV sem internet, abrindo um turno, registrando uma venda de produto já disponível no catálogo local e fechando o turno com os totais do período.

**Acceptance Scenarios**:

1. **Given** o PDV está sem internet e possui catálogo previamente recebido, **When** o operador abre um turno, registra uma venda e informa o pagamento, **Then** a venda é concluída localmente e fica pendente de envio para a nuvem.
2. **Given** existem vendas locais no turno aberto, **When** o operador fecha o turno, **Then** o PDV apresenta o resumo local de vendas e pagamentos e impede novas vendas até a abertura de outro turno.
3. **Given** o operador tenta vender sem turno aberto, **When** inicia o fechamento da venda, **Then** o PDV bloqueia a conclusão e orienta a abrir um turno.

---

### User Story 3 - Consultar Produto com Saldo Local Simples no PDV (Priority: P3)

O operador precisa buscar produtos no PDV usando uma cópia local simples do catálogo, visualizando preço e um saldo local calculado apenas para apoiar a venda.

**Why this priority**: O operador precisa decidir rapidamente se pode oferecer o produto, mas o PDV não deve assumir a responsabilidade contábil de estoque.

**Independent Test**: Pode ser testado sincronizando produtos da nuvem para o PDV, registrando vendas e cancelamentos ainda não sincronizados, e verificando que o saldo exibido corresponde ao saldo publicado pela nuvem menos vendas locais pendentes mais cancelamentos locais pendentes.

**Acceptance Scenarios**:

1. **Given** a nuvem publicou produtos para o PDV, **When** o operador pesquisa um produto, **Then** o PDV exibe identificação, preço de venda e saldo publicado ajustado pelas pendências locais.
2. **Given** um produto aparece no PDV, **When** o operador acessa seus detalhes, **Then** não existem comandos locais para cadastrar, editar, receber, inventariar, ajustar custo ou alterar estoque contábil.
3. **Given** há vendas locais ainda não sincronizadas para um produto, **When** o PDV mostra o saldo local, **Then** o saldo exibido diminui pela quantidade dessas vendas pendentes.
4. **Given** há cancelamentos locais ainda não sincronizados para um produto, **When** o PDV mostra o saldo local, **Then** o saldo exibido aumenta pela quantidade desses cancelamentos pendentes.

---

### User Story 4 - Centralizar Rotinas Administrativas de Estoque na Nuvem (Priority: P4)

A gestão da livraria precisa que entradas, inventários, ajustes, custos, saldos oficiais e reconciliações de estoque sejam feitos na nuvem, usando as vendas do PDV como eventos de saída quando sincronizadas.

**Why this priority**: Reduz a complexidade do PDV e concentra a responsabilidade de estoque em um único ambiente administrativo.

**Independent Test**: Pode ser testado registrando vendas no PDV, sincronizando com a nuvem e conferindo que a nuvem incorpora as vendas ao histórico oficial de estoque sem permitir que o PDV edite esse histórico diretamente.

**Acceptance Scenarios**:

1. **Given** uma venda local foi sincronizada, **When** a nuvem processa a venda, **Then** ela passa a compor o histórico oficial de saídas de estoque.
2. **Given** um usuário administrativo precisa lançar entrada, ajuste ou inventário, **When** acessa o sistema, **Then** essas operações estão disponíveis somente na nuvem.
3. **Given** há divergência entre saldo simples do PDV e saldo oficial da nuvem, **When** a sincronização ocorrer, **Then** a nuvem permanece como referência oficial e publica um novo saldo simples para o PDV.

### Edge Cases

- O PDV inicia sem catálogo local: deve informar que é necessário sincronizar antes de vender produtos cadastrados.
- O PDV perde internet durante uma venda: a venda deve continuar localmente se o produto já estiver disponível no catálogo local.
- A nuvem recebe duas vezes a mesma venda do PDV: a venda deve ser reconhecida como a mesma ocorrência e não deve duplicar saída, pagamento ou total.
- A nuvem recebe cabeçalho, itens e pagamentos de uma venda em momentos diferentes: o estoque oficial deve aguardar a marcação de venda completa/pronta antes de gerar baixa.
- A nuvem recebe duas vezes o mesmo cancelamento: o estorno deve ser reconhecido como a mesma ocorrência e não deve duplicar devolução de estoque; a quantidade estornada deve espelhar os movimentos oficiais gerados pela venda original.
- O produto vendido offline foi inativado ou teve saldo oficial insuficiente na nuvem: a nuvem deve registrar a divergência para conferência administrativa sem apagar a venda local já concluída; a quantidade vendida deve baixar integralmente mesmo se o saldo oficial ficar negativo.
- Uma venda tenta referenciar produto desconhecido: deve ser considerada inválida, pois toda venda válida deve referenciar produto conhecido/publicado.
- A produção já possui saldos e movimentos antes da nova automação: o saldo atual deve ser preservado como ponto de partida, e divergências históricas devem ser tratadas por conferência administrativa explícita, não por reprocessamento automático.
- O operador tenta cadastrar produto, fornecedor, entrada, inventário, ajuste ou custo no PDV: o PDV deve impedir a operação e indicar que a rotina pertence à nuvem.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O PDV MUST permitir localmente apenas abertura de turno, registro de vendas, consulta de catálogo disponível, fechamento de turno e consulta operacional necessária para essas ações.
- **FR-002**: O PDV MUST remover ou bloquear rotinas locais de cadastro e manutenção que não sejam venda ou turno, incluindo produto, fornecedor, entrada, inventário, ajuste de estoque, custo e configurações administrativas de estoque.
- **FR-003**: O PDV MUST operar vendas e turno sem internet quando já possuir os dados mínimos recebidos anteriormente.
- **FR-004**: O PDV MUST usar o catálogo recebido da nuvem como cópia operacional, exibindo dados necessários para venda e um saldo simples não autoritativo.
- **FR-005**: O saldo exibido no PDV MUST ser comunicado como saldo operacional simples, sem status de saldo oficial ou contábil.
- **FR-006**: A nuvem MUST ser a única referência oficial para cadastro de produtos, manutenção de catálogo, entradas, inventários, ajustes, custos, saldos contábeis e reconciliações de estoque.
- **FR-007**: As vendas realizadas no PDV MUST ser enviadas para a nuvem como eventos de venda identificáveis e reaplicáveis sem duplicidade.
- **FR-008**: A nuvem MUST incorporar vendas sincronizadas do PDV ao histórico oficial de estoque como saídas automáticas, mantendo rastreabilidade entre venda, turno e origem.
- **FR-009**: A nuvem MUST publicar para o PDV uma visão simplificada de produtos vendáveis com os dados mínimos para operação de balcão.
- **FR-010**: O PDV MUST preservar vendas e fechamentos de turno locais até confirmação de sincronização, sem exigir que o operador refaça lançamentos.
- **FR-011**: O sistema MUST destacar divergências entre vendas offline e o saldo oficial da nuvem para tratamento administrativo na nuvem.
- **FR-012**: Relatórios contábeis e gerenciais de estoque MUST usar os dados oficiais da nuvem, não o saldo simples armazenado no PDV.
- **FR-013**: O fechamento local de turno MUST resumir vendas, pagamentos e pendências de sincronização do período.
- **FR-014**: A experiência do PDV MUST favorecer operação rápida de balcão, sem apresentar telas administrativas que aumentem responsabilidade do operador local.
- **FR-015**: A nuvem MUST estornar automaticamente o estoque oficial quando uma venda já incorporada ao estoque for cancelada.
- **FR-016**: A geração de saídas e estornos de estoque por venda/cancelamento MUST ser idempotente, mesmo se o mesmo evento for reenviado ou reprocessado.
- **FR-017**: Aplicações cliente MUST NOT ser responsáveis por gravar manualmente os movimentos oficiais de saída ou estorno derivados de venda e cancelamento.
- **FR-018**: O saldo local exibido no PDV MUST ser calculado como saldo publicado pela nuvem menos vendas locais ainda não sincronizadas mais cancelamentos locais ainda não sincronizados.
- **FR-019**: A nuvem MUST disponibilizar uma fila, lista ou indicador de divergências de estoque geradas por vendas offline para conferência administrativa.
- **FR-020**: Quando uma venda válida referencia um produto existente e a quantidade vendida excede o saldo oficial disponível, a nuvem MUST baixar a quantidade integral vendida e permitir saldo oficial negativo até conferência administrativa.
- **FR-021**: Cancelamentos de vendas já incorporadas ao estoque oficial MUST estornar exatamente os movimentos oficiais gerados pela venda original, preservando vínculo auditável entre saída e estorno.
- **FR-022**: A nuvem MUST gerar movimentos oficiais de saída somente para vendas marcadas como completas/prontas, evitando baixa sobre registros parciais de sincronização.
- **FR-023**: Toda venda válida MUST referenciar apenas produtos conhecidos/publicados para o PDV; venda com produto desconhecido é inválida e não faz parte do fluxo operacional aceito.
- **FR-024**: A implantação da automação oficial de estoque MUST preservar o saldo atual em produção como saldo de partida, sem reprocessar histórico para alterar saldos atuais.
- **FR-025**: Correções de divergências históricas MUST ser feitas por conferência administrativa explícita, preservando rastreabilidade, em vez de recomputação automática silenciosa.

### Key Entities *(include if feature involves data)*

- **Produto Publicado para PDV**: Representa um produto vendável recebido da nuvem, com identificação, descrição, preço, situação de venda e saldo simples para consulta operacional.
- **Saldo Local Simples do PDV**: Quantidade indicativa calculada no PDV a partir do saldo publicado pela nuvem, ajustada por vendas e cancelamentos locais ainda não sincronizados; não representa livro fiscal, inventário oficial ou custo contábil.
- **Venda Local**: Registro feito no PDV durante um turno, contendo apenas produtos conhecidos/publicados, itens, quantidades, valores, pagamentos, origem e estado de sincronização.
- **Venda Completa/Pronta**: Venda que já possui os dados mínimos necessários para incorporação oficial na nuvem e pode gerar movimentos oficiais de estoque.
- **Cancelamento Local**: Registro de cancelamento de venda feito no PDV antes da sincronização, usado para ajustar o saldo local simples e depois comunicar o estorno à nuvem.
- **Turno Local**: Período operacional aberto e fechado no PDV, usado para organizar vendas, pagamentos e conferência local de caixa.
- **Estoque Oficial na Nuvem**: Histórico autoritativo de entradas, saídas, inventários, ajustes, custos e saldos contábeis.
- **Saldo de Partida em Produção**: Saldo atual preservado no momento de ativação da nova automação oficial de estoque.
- **Divergência de Estoque**: Situação detectada na nuvem quando uma venda sincronizada entra em conflito com saldo, situação do produto ou outra regra administrativa.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um operador consegue abrir turno, concluir uma venda e fechar turno no PDV sem internet em até 5 minutos durante teste assistido.
- **SC-002**: 100% das rotinas de cadastro, entrada, inventário, ajuste e custo ficam indisponíveis no PDV para usuários de balcão.
- **SC-003**: 100% das vendas sincronizadas chegam à nuvem com vínculo verificável de origem e turno, gerando saída oficial uma única vez quando reenviadas.
- **SC-004**: Relatórios oficiais de estoque usam exclusivamente dados da nuvem em 100% dos cenários de conferência definidos.
- **SC-005**: Em testes de operação, pelo menos 90% dos operadores identificam corretamente que o saldo exibido no PDV é apenas operacional.
- **SC-006**: Divergências causadas por venda offline contra saldo oficial desatualizado aparecem para conferência administrativa em até 1 ciclo de sincronização após reconexão.
- **SC-007**: 100% dos cancelamentos sincronizados de vendas já incorporadas ao estoque oficial geram estorno uma única vez quando reenviados.
- **SC-008**: Em testes com vendas e cancelamentos pendentes, o saldo local simples do PDV bate com a fórmula definida em 100% dos produtos avaliados.
- **SC-009**: 100% das vendas válidas com saldo oficial insuficiente baixam a quantidade integral vendida e aparecem na lista de divergências de estoque.
- **SC-010**: 100% dos cancelamentos de vendas incorporadas ao estoque oficial estornam exatamente as quantidades dos movimentos da venda original.
- **SC-011**: 0 vendas parciais geram movimento oficial de estoque antes de serem marcadas como completas/prontas.
- **SC-012**: 100% das vendas aceitas para sincronização referenciam somente produtos conhecidos/publicados.
- **SC-013**: Após ativação da automação, 100% dos produtos mantêm o saldo de partida de produção até que novas vendas, cancelamentos ou ajustes administrativos explícitos ocorram.

## Assumptions

- A nuvem já é o ambiente administrativo principal e continuará exigindo usuário autorizado para rotinas de estoque.
- O PDV continuará sendo offline-first para venda e turno, com sincronização posterior quando houver conectividade.
- O catálogo publicado para o PDV conterá apenas produtos que a livraria deseja permitir na operação de balcão.
- Vendas locais concluídas não serão apagadas automaticamente por divergências posteriores; a correção ocorre por rotina administrativa na nuvem.
- A primeira responsabilidade a migrar para a nuvem é estoque; outras responsabilidades administrativas podem seguir o mesmo padrão em features futuras.
- A primeira etapa prática é auditar e corrigir o funcionamento de estoque em produção antes de reduzir telas ou responsabilidades do PDV.

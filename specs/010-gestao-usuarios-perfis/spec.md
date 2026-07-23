# Feature Specification: Gestão de usuários com perfis (operador/admin) e controle de acesso

**Feature Branch**: `010-gestao-usuarios-perfis`

**Created**: 2026-07-22

**Status**: Draft

**Input**: User description: "vamos implementar a ui de cadstro de novos usuários e senha, usuarios com perfil operador e admin, os tipo operador so podem entrar no pdv os admim em ambos"

## Clarifications

### Session 2026-07-22

- Q: O perfil (operador/admin) controla só o acesso PDV-vs-escritório ou também restringe o que a pessoa faz dentro do PDV? → A: Só o acesso (onde a pessoa entra). Dentro do PDV, operador e admin têm as mesmas capacidades.
- Q: Usuário desativado/rebaixado com o PDV offline e sessão já aberta — quando a mudança vale? → A: Ao sincronizar, o PDV **encerra a sessão ativa** na hora (logout forçado), não só no próximo login.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin cadastra um novo usuário com senha e perfil (Priority: P1)

Um administrador abre a área de gestão de usuários no escritório e cadastra uma nova pessoa,
informando um identificador de usuário, o nome, uma senha inicial e o perfil (operador ou admin).
A partir daí essa pessoa consegue entrar nos sistemas que seu perfil permite, usando a **mesma**
credencial (a identidade é única entre PDV e escritório).

**Why this priority**: É o coração do pedido — hoje só o `adm` existe e não há como criar novos
acessos de forma central. Sem isso, não há gestão de quem opera o caixa nem quem administra.

**Independent Test**: Cadastrar um usuário novo (identificador, nome, senha, perfil) e confirmar que
ele consegue logar onde o perfil permite e que a credencial é a mesma no PDV e no escritório.

**Acceptance Scenarios**:

1. **Given** um admin logado no escritório, **When** ele cadastra um usuário com identificador, nome,
   senha e perfil "operador", **Then** o usuário passa a existir e consegue logar no PDV com essa senha.
2. **Given** um admin logado, **When** ele cadastra um usuário com perfil "admin", **Then** esse novo
   usuário consegue logar tanto no PDV quanto no escritório com a mesma senha.
3. **Given** um identificador de usuário já existente, **When** o admin tenta cadastrar outro igual,
   **Then** o sistema recusa e explica que o identificador já está em uso.

---

### User Story 2 - Acesso restrito por perfil: operador só no PDV, admin em ambos (Priority: P1)

O perfil do usuário decide onde ele pode entrar: **operador** acessa **apenas o PDV**; **admin**
acessa **PDV e escritório**. Quem tenta entrar num sistema que seu perfil não permite é barrado com
uma mensagem clara, sem vazar detalhes.

**Why this priority**: É a regra de segurança central do pedido ("operador só no PDV, admin em ambos").
Sem ela, o cadastro de perfis não tem efeito prático.

**Independent Test**: Com um usuário operador e um admin já criados, tentar logar cada um no PDV e no
escritório e verificar que operador é aceito só no PDV e admin nos dois.

**Acceptance Scenarios**:

1. **Given** um usuário perfil operador, **When** ele tenta entrar no escritório, **Then** o acesso é
   negado com mensagem clara e ele permanece fora.
2. **Given** um usuário perfil operador, **When** ele entra no PDV, **Then** o acesso é concedido.
3. **Given** um usuário perfil admin, **When** ele entra no PDV **ou** no escritório, **Then** o acesso
   é concedido nos dois.
4. **Given** um usuário desativado, **When** ele tenta entrar em qualquer sistema, **Then** o acesso é
   negado.

---

### User Story 3 - Admin gerencia usuários existentes (editar, redefinir senha, desativar) (Priority: P2)

O admin vê a lista de usuários e pode: editar o nome e o perfil, redefinir a senha (sem nunca ver a
senha antiga) e desativar quem não deve mais ter acesso. O sistema protege o último admin ativo.

**Why this priority**: Ciclo de vida do usuário. Importante para operação real (rotatividade,
correções, perda de senha), mas o valor inicial já é entregue por US1+US2.

**Independent Test**: Sobre usuários já cadastrados, alterar nome/perfil, redefinir uma senha e
desativar um usuário, confirmando os efeitos (novo login funciona, desativado não entra) e que o
último admin não pode ser rebaixado/desativado.

**Acceptance Scenarios**:

1. **Given** um usuário existente, **When** o admin redefine a senha, **Then** a senha anterior deixa
   de funcionar e a nova passa a valer.
2. **Given** um usuário operador, **When** o admin muda seu perfil para admin, **Then** ele passa a
   poder entrar no escritório.
3. **Given** um único admin ativo no sistema, **When** o admin tenta desativá-lo ou rebaixá-lo para
   operador, **Then** o sistema impede a ação e explica que precisa existir ao menos um admin.
4. **Given** um usuário ativo, **When** o admin o desativa, **Then** ele deixa de logar em qualquer
   sistema, mas seu histórico (vendas atribuídas) permanece.

---

### Edge Cases

- **Último admin**: nunca é possível deixar o sistema sem nenhum admin ativo (bloquear desativar ou
  rebaixar o último admin).
- **Operador no escritório**: barrado com mensagem clara ("perfil sem acesso ao escritório"), sem
  revelar se o usuário existe ou a senha está certa.
- **Identificador duplicado**: cadastro recusado com mensagem específica.
- **Senha redefinida**: sessões/login com a senha antiga param de valer.
- **Usuário recém-criado e PDV offline**: enquanto a criação não sincroniza para o PDV, aquele usuário
  ainda não consegue logar naquele PDV offline; passa a conseguir após a próxima sincronização.
- **Desativado/rebaixado com sessão ativa no PDV**: a mudança feita no escritório só chega ao PDV na
  sincronização; ao sincronizar, o PDV **encerra a sessão ativa** do usuário (logout forçado). Antes
  disso (offline), a sessão já aberta segue até sincronizar.
- **Senha em branco/curta demais**: cadastro recusado com orientação sobre o mínimo exigido.
- **Desativar a si mesmo**: um admin não deve conseguir se desativar se for o último admin (cai na
  regra do último admin).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE permitir que um admin cadastre um novo usuário informando identificador,
  nome, senha e perfil.
- **FR-002**: Cada usuário DEVE ter exatamente um perfil: **operador** ou **admin**.
- **FR-003**: Usuário de perfil **operador** DEVE poder acessar apenas o PDV, e NÃO o escritório.
- **FR-004**: Usuário de perfil **admin** DEVE poder acessar tanto o PDV quanto o escritório.
- **FR-005**: A mesma credencial (identificador + senha) DEVE valer nos dois sistemas (identidade única).
- **FR-006**: O sistema DEVE permitir que um admin edite o nome e o perfil de um usuário existente.
- **FR-007**: O sistema DEVE permitir que um admin redefina a senha de qualquer usuário.
- **FR-008**: O sistema DEVE permitir que um admin desative um usuário; usuário desativado NÃO acessa
  nenhum sistema, mas seu histórico é preservado.
- **FR-009**: A senha definida no escritório DEVE ficar disponível para login no PDV inclusive **sem
  internet** (após a sincronização que a propaga).
- **FR-010**: Apenas usuários **admin** DEVEM poder acessar a área de gestão de usuários.
- **FR-011**: O sistema DEVE impedir dois usuários com o mesmo identificador.
- **FR-012**: A senha NUNCA DEVE ser exibida nem recuperável em texto; só pode ser **redefinida**.
- **FR-013**: Em falha de login ou tentativa de acesso a sistema não permitido pelo perfil, o sistema
  DEVE mostrar mensagem clara **sem** revelar se o usuário existe ou qual campo falhou.
- **FR-014**: O sistema DEVE garantir que sempre exista ao menos um **admin ativo** (bloquear
  desativar/rebaixar o último admin).
- **FR-015**: O sistema DEVE recusar senhas com menos de **4 caracteres** (política mínima; valor
  ajustável — ver Assumptions).
- **FR-016**: O sistema DEVE registrar/atribuir ações relevantes (ex.: vendas) ao usuário logado,
  mantendo a atribuição mesmo após o usuário ser desativado.
- **FR-017**: O perfil DEVE controlar **apenas o acesso** a cada sistema (PDV / escritório na nuvem);
  ele NÃO restringe capacidades **dentro** do PDV — operador e admin executam as mesmas funções no PDV.
- **FR-018**: Ao desativar um usuário ou rebaixá-lo (perda de acesso àquele sistema), assim que o PDV
  **sincronizar** ele DEVE **encerrar a sessão ativa** desse usuário na hora (logout forçado), sem
  esperar o próximo login.

### Key Entities *(include if feature involves data)*

- **Usuário**: representa uma pessoa com acesso aos sistemas. Atributos: **identificador** (chave
  natural, único), **nome**, **senha** (guardada de forma não reversível), **perfil**
  (operador | admin), **estado** (ativo | desativado). É a mesma entidade de identidade compartilhada
  entre PDV e escritório.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um admin cadastra um novo usuário completo (identificador, nome, senha, perfil) em
  **menos de 1 minuto**.
- **SC-002**: **100%** das tentativas de um operador entrar no escritório são barradas.
- **SC-003**: Um usuário criado no escritório consegue logar no PDV **inclusive offline**, na primeira
  operação após a sincronização que o propaga.
- **SC-004**: **Zero** senhas aparecem em texto claro em qualquer tela, exportação ou registro de log.
- **SC-005**: Em **100%** das tentativas, é impossível deixar o sistema sem nenhum admin ativo.
- **SC-006**: **100%** dos usuários desativados são impedidos de logar em ambos os sistemas, e nenhuma
  venda/histórico anteriormente atribuído a eles é perdido.

## Assumptions

- **Reusa a identidade unificada** (ADR-0019): a mesma tabela/identidade de usuário já usada por PDV e
  escritório; este feature adiciona **perfil** e a **UI de gestão**.
- **Sem recuperação de senha por e-mail** (offline-first, sem infraestrutura de e-mail): a redefinição
  é sempre feita por um admin. Autoatendimento de troca de senha pelo próprio usuário fica **fora do
  escopo** desta versão.
- **Propagação da senha ao PDV** depende da sincronização do hash de senha para a réplica local
  (continuação do ADR-0019 — a senha definida no escritório desce para o PDV pelo sync). É uma
  **dependência** desta feature.
- **Perfis são mutuamente exclusivos** (operador OU admin), com espaço para novos perfis no futuro sem
  reformular o modelo.
- O usuário **`adm` existente é admin** e é preservado.
- **Política mínima de senha**: pelo menos **4 caracteres** (default operacional, ajustável).
- A **gestão de usuários vive no escritório** (retaguarda), não no PDV. O PDV apenas autentica.
- **Não há papéis intermediários** (ex.: "gerente") nesta versão — só operador e admin.

## Dependencies

- **ADR-0019 — Identidade unificada na tabela `usuario`** (já implementado em parte): login por
  usuário/senha no escritório, senha em hash forte, RPC de autenticação. Esta feature depende de
  concluir a **sincronização do hash de senha para o PDV** e adicionar **definição de senha** e o campo
  **perfil**.

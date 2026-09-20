# Feature Specification: Cadastro de LLM e identidade do operador do PDV

**Feature Branch**: `codex/cadastro-llm`
**Created**: 2026-09-19
**Status**: Implemented and locally validated; not deployed
**Input**: Cadastro de LLM para uso no PDV e retaguarda; tarefas solicitadas pelo
token da máquina em nome do usuário do turno, sem pedir sua senha novamente.

## User Scenarios & Testing

### User Story 1 - Administrar configurações de LLM (Priority: P1)

O administrador cadastra uma configuração com nome, provedor, endereço, modelo,
credencial e disponibilidade para PDV e/ou retaguarda. Pode editar, desativar e
testar a conexão. As credenciais não são devolvidas na consulta do cadastro.

**Why this priority**: Fornece a configuração compartilhada para futuras tarefas.
**Independent Test**: Criar, consultar, editar mantendo a credencial, substituir
a credencial, testar e desativar uma configuração.

**Acceptance Scenarios**:
1. **Given** administrador autenticado, **When** cadastra uma configuração válida,
   **Then** ela aparece na lista sem expor a credencial.
2. **Given** operador ou máquina autenticada, **When** tenta administrar credenciais,
   **Then** a operação é recusada.
3. **Given** configuração desativada, **When** uma tarefa tenta utilizá-la,
   **Then** o provedor não é chamado.

### User Story 2 - Usar a identidade do turno (Priority: P1)

O PDV solicita tarefas com a credencial da máquina e o identificador do turno.
A retaguarda resolve o operador daquele turno e verifica suas permissões, sem
solicitar novamente a senha nem herdar privilégios do cadastrador da máquina.

**Why this priority**: Evita atribuição incorreta e pedidos de senha no balcão.
**Independent Test**: Máquina cadastrada por administrador, turno de operador;
o contexto resultante deve ter as permissões do operador.

**Acceptance Scenarios**:
1. **Given** máquina ativa e turno aberto válido, **When** solicita tarefa permitida,
   **Then** a tarefa identifica máquina, turno e operador sem senha adicional.
2. **Given** turno de outra máquina, encerrado ou operador inativo, **When** solicita
   tarefa, **Then** a solicitação é recusada antes de chamar o provedor.
3. **Given** turno ainda não recebido pela retaguarda, **When** solicita tarefa,
   **Then** o PDV envia o turno pelo fluxo existente e só prossegue após confirmação.

### Edge Cases

- Credencial ausente, inválida, revogada ou substituída durante edição.
- Máquina revogada, turno encerrado e tentativa de indicar outro usuário.
- Provedor indisponível, tempo limite e resposta inválida.
- Ausência de internet: operações locais de venda continuam disponíveis.
- Configuração editada simultaneamente e tarefa com configuração inativa.

## Requirements

### Functional Requirements

- **FR-001**: Administrar configurações na retaguarda com nome, provedor, modelo,
  endereço, credencial, situação e habilitação por origem.
- **FR-002**: Somente administradores humanos podem alterar as configurações.
- **FR-003**: Proteger credenciais em armazenamento; não enviá-las ao PDV, listagens,
  mensagens de erro ou registros de auditoria.
- **FR-004**: Permitir edição sem obrigar a informar novamente a credencial.
- **FR-005**: Oferecer teste de conexão com retorno compreensível e tempo limitado.
- **FR-006**: Reutilizar a autenticação da máquina nas solicitações do PDV.
- **FR-007**: Resolver o operador pelo turno aberto vinculado à máquina autenticada;
  ignorar alegações de perfil ou identidade fornecidas pelo cliente.
- **FR-008**: Aplicar permissões do operador efetivo à tarefa solicitada.
- **FR-009**: Registrar configuração, origem, máquina, turno, operador, horário e
  resultado dos testes autorizados, sem gravar segredos ou conteúdos integrais.
- **FR-010**: Não introduzir dependência de LLM ou internet na venda local.
- **FR-011**: Não transformar respostas de LLM em autorização para ações do sistema.

### Key Entities

- **Configuração LLM**: Identidade, nome, provedor, modelo, endereço, credencial
  protegida, situação e origens habilitadas.
- **Contexto de execução**: Origem, usuário efetivo, permissões, máquina e turno.
- **Registro de uso**: Identificação da solicitação e seu resultado, sem segredos.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Administrador conclui cadastro e teste em até três minutos com dados válidos.
- **SC-002**: Todas as solicitações aceitas do PDV identificam o operador do turno,
  e nenhuma exige digitação de sua senha.
- **SC-003**: Todos os cenários de turno inválido, máquina revogada e operador
  sem permissão são recusados antes de executar a tarefa.
- **SC-004**: Nenhuma resposta de listagem ou consulta expõe a credencial armazenada.

## Assumptions and scope

- Cadastro central na retaguarda; PDV consome configurações autorizadas.
- Primeira entrega presumida: cadastro, teste e contexto de autorização. Tarefas
  de negócio específicas dependem de sua definição pelo usuário.
- Provedores confirmados: APIs compatíveis com OpenAI (incluindo servidores locais)
  e Google Gemini. Escopo confirmado: cadastro e teste de conexão; sem tarefas de IA.
- Selecionar um operador no PDV é o modelo de confiança existente; esta feature
  não constitui prova de autenticação pessoal adicional.

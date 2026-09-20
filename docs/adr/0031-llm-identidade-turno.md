# ADR-0031: LLM central e identidade do operador do turno

Status: aceito para implementação. Data: 2026-09-19.

O token da máquina identifica o equipamento e seu cadastrador. Não representa,
por si só, a pessoa que opera o turno. Tarefas de LLM do PDV devem ser atribuídas
ao operador do turno aberto vinculado à máquina, com suas permissões atuais.

O cadastro fica na retaguarda e somente administradores humanos podem alterá-lo.
As credenciais dos provedores ficam criptografadas no servidor com chave dedicada
do ambiente, nunca devolvidas ao navegador ou PDV. O PDV autentica com seu token,
envia o turno e recebe somente configurações habilitadas para sua origem.

A primeira entrega testa acesso aos metadados do modelo: OpenAI-compatible Models
e Google Gemini Models. Não gera conteúdo nem executa ações de negócio. Destinos
extras exigem permissão explícita de configuração, inclusive para redes locais.

O servidor valida máquina, vínculo do turno, situação aberta e usuário ativo.
Não substitui o principal global das APIs existentes e não concede permissão
administrativa ao equipamento. A seleção de operador mantém o modelo de confiança
já adotado pelo PDV. Revogação da máquina continua pelo mecanismo atual.

Consequências: uso online de LLM; operações locais independentes; chave criptográfica
deve acompanhar backups e ser gerida no ambiente/Notion. Testes reais de provedores
dependem de credenciais cadastradas pelo administrador. Sem API de execução genérica.

Referências: https://developers.openai.com/api/reference/resources/models e
https://ai.google.dev/api/models; https://ai.google.dev/gemini-api/docs/api-key.

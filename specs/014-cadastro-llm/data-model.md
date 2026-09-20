# Dados

`llm_configuracao`: UUID, nome, provedor (`openai-compatible`/`google`), endereço base,
modelo, credencial criptografada opcional, ativo, habilitação PDV/retaguarda, versão
incremental e autor/data da última alteração. Sem exclusão física; desativação via edição.

`llm_auditoria`: UUID, configuração, usuário efetivo, máquina/turno opcionais,
ação, resultado e horário. Tentativas de conexão gravam INICIADO antes da chamada,
depois código de resultado. Sem corpo de resposta ou chave. CRUD grava auditoria
na mesma transação. Recusas de autenticação/autorização não chamam o provedor.

A chave AES não fica no banco. O UUID da configuração participa da autenticação
do conteúdo criptografado, impedindo mover uma credencial entre registros.

# Contratos

API `/api/v1`:

- GET/POST `admin/llms`: listar/criar (administrador humano).
- PUT `admin/llms/:uid`: editar com versão atual; 409 para versão desatualizada.
- POST `admin/llms/:uid/testar`: testar configuração ativa (administrador humano).
- GET `llms?turnoUid=UUID`: somente opções ativas da origem; não retorna endereço/chave.
- POST `llms/:uid/testar`, corpo `{turnoUid}`: resolve contexto e testa.

Na retaguarda, sessão pessoal permanece usada normalmente. No PDV, Bearer da
máquina + turno validado pelo servidor. Não aceitar perfil/usuário alegado no corpo.
Respostas de teste: `{ok, codigo, mensagem}`; falha de provedor é resultado do teste.
Falha de autorização é 401/403, configuração inválida 400, ausente 404.

Tauri: `llms_listar` e `llm_testar({uid})`; selecionam o único turno aberto da
máquina no banco local, reenviam abertura idempotente e usam o token da máquina.
Não recebem usuário, turno, endereço ou segredo do frontend.

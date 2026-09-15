# Usuarios administrativos via API

`API_USUARIOS_ENABLED=false` mantem o fluxo legado durante o rollout. Quando
ativa, a tela `/usuarios` lista, cria, edita, redefine senha, desativa e reativa
exclusivamente pelo proxy server-side e pela API NestJS. `/operadores` redireciona
para a tela unificada, eliminando o cadastro antigo sem senha.

A API exige JWT individual de administrador em todas as operacoes. Senhas sao
validadas e convertidas em bcrypt dentro do PostgreSQL; hash e credenciais nunca
retornam para o navegador. Alteracao de perfil e ativacao bloqueiam a remocao do
ultimo administrador ativo sob lock transacional. O identificador e imutavel,
canonico e minusculo conforme ADR-0025.

O login ainda abre tambem a sessao compartilhada Supabase enquanto houver telas
legadas. Ela sera removida somente depois de T017e. Ativar a chave de usuarios
antes de publicar API e web compativeis bloqueia a tela e, por desenho, nao faz
fallback silencioso.

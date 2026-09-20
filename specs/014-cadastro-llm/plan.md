# Plano: cadastro LLM

## Contexto técnico

API NestJS/PostgreSQL com migrations SQL idempotentes. Interface Next.js da
retaguarda com componentes compartilhados e referência WowDash. PDV Tauri/Rust
usa credencial da máquina no cofre nativo. Sem migration SQLite nesta feature.

## Constituição

Domínio puro preservado; integração nos adapters. Arquivos abaixo de 300 linhas.
Nenhum valor monetário novo. Venda offline independente da integração. Migração
aditiva, sem modificar tabelas operacionais. Segredos fora do repositório.

## Decisões

- Credenciais criptografadas com AES-256-GCM e chave de ambiente dedicada.
- Cadastro administrativo separado do uso autenticado por máquina/turno.
- Teste consulta metadados do modelo, sem geração ou envio de dados comerciais.
- Destinos oficiais permitidos por padrão; servidores compatíveis adicionais
  precisam de endereço base explicitamente permitido na configuração do servidor.
  Isso permite instalações locais sem liberar acesso arbitrário à rede interna.
- Redirecionamentos recusados, tempo e tamanho de resposta limitados.
- Perfis do operador resolvidos no servidor pelo turno, nunca herdados da máquina.
- Expor configurações autorizadas e teste no PDV; sem gerenciar credenciais no PDV.

## Estrutura e sequência

1. Migração 006: configurações e auditoria, sem credenciais em respostas.
2. Serviço de contexto por turno, proteção de credenciais e adapters de teste.
3. Cadastro na retaguarda e proxy autenticado; UI seguindo usuários/configurações.
4. Comandos de leitura/teste no PDV usando máquina + turno e envio prévio do turno.
5. Testes de autorização, criptografia, provedores simulados, migrations e UI.

## Validação

Testar criação/edição/desativação, concorrência por versão, chaves mascaradas,
turno de outra máquina, usuário desativado, turno encerrado, máquina sem turno,
redirecionamento, timeout, metadados de modelo incorretos e limites de resposta.
Usar PostgreSQL isolado e provedores simulados; não consumir APIs pagas nos testes.

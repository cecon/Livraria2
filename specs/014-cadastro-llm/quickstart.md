# Validação e implantação

1. Aplicar `apps/nuvem/api/sql/006_llm.sql` por comando no banco da retaguarda.
   A migration é aditiva e idempotente. Não há migration SQLite do PDV.
2. Configurar `LLM_ENCRYPTION_KEY`: 32 bytes aleatórios codificados como 64 caracteres
   hexadecimais. Manter no ambiente seguro/Notion, fora do repositório. Não reutilizar
   a chave JWT. Preservar junto aos backups; trocar sem recriptografar impede leitura.
3. Para provedores compatíveis extras, configurar `LLM_ALLOWED_BASE_URLS` com endereços
   base completos separados por vírgula (incluindo o caminho da API). A permissão
   explícita é necessária inclusive para servidores locais. Endereços são acessados
   a partir do servidor da retaguarda, não do navegador nem da máquina PDV.
   O compose `apps/nuvem/web/stack.yml` encaminha as duas variáveis ao serviço API.
   Recriar o serviço é necessário para incorporar variáveis de ambiente novas.
4. Administrador acessa **LLMs**, cadastra provedor/modelo/chave e testa a conexão.
   A edição com chave vazia preserva a chave anterior. Trocar destino requer informá-la
   novamente. Google usa a Gemini Developer API; credenciais Vertex AI não são suportadas.
5. PDV: **Configurações → Modelos de IA → Consultar modelos**. Exige turno aberto
   válido desta máquina e conexão com a retaguarda, sem nova senha pessoal.

## Testes locais

`npm run build:api`

`node --test --test-concurrency=1 apps/nuvem/api/tests/llm-provider.cjs apps/nuvem/api/tests/llm.cjs`

O teste de integração cria e remove um container PostgreSQL próprio. Usa portas
55441 (banco), 3309 (API) e 3389 (provedor simulado). Não lê credenciais reais nem
modifica o banco do PDV. Requer Docker e a imagem postgres:16-alpine.

`npm run test:api -w livraria-escritorio`

`npm run build` e `npm run build:web`; `cargo check --manifest-path apps/pdv/src-tauri/Cargo.toml`.

Testes de conexão consultam metadados do modelo, sem inferência. Uma conexão aprovada
não garante cota ou suporte a uma futura tarefa. APIs compatíveis devem implementar
consulta individual de modelos. Credenciais reais devem ser cadastradas pelo administrador.

# API da nuvem

Na raiz: npm run dev:api. Health: http://127.0.0.1:3001/api/v1/health.

DATABASE_URL deve vir do ambiente seguro. Nunca versionar credenciais.
db:validate e db:generate nao modificam banco. db:introspect le o schema existente.
O schema foi introspectado do banco real, sem copiar dados. O ledger SQL historico
continua como autoridade. db:baseline:check confere seus hashes sem alterar banco.
Nao executar db push/reset ou Prisma Migrate sobre este schema.

Ainda nao substitui a sincronizacao Supabase. Plano e tarefas:
specs/013-separacao-pdv-nuvem.

## Protocolo experimental

API_OPERATIONS_ENABLED=true habilita as rotas. Exige DATABASE_URL e
API_JWT_SECRET com pelo menos 32 bytes, vindos do ambiente seguro.
sql/001_protocolo_catalogo.sql e aplicado explicitamente somente ao banco de ensaio.
Nao e distribuido pelo migrator legado e ainda nao foi aplicado em producao.

- POST /api/v1/auth/login: usuario/senha existentes, JWT individual de 15 minutos.
- GET /api/v1/auth/me: identidade e perfil atuais; usuarios desativados sao negados.
- POST /api/v1/pdvs: admin registra dispositivo ligado a usuario ativo.
- POST /api/v1/pdvs/:uid/token: admin troca credenciais e revoga as anteriores.
- POST /api/v1/pdvs/:uid/desativar: admin revoga o dispositivo.
- POST /api/v1/auth/pdv/renovar: pdvUid/refreshToken renova JWT sem senha humana.
- GET /api/v1/pdvs: admin consulta cursores entregue, aplicado e disponivel.
- GET /api/v1/sync/catalogo: dispositivo recebe pagina a partir de cursor confirmado.
- POST /api/v1/sync/catalogo/confirmacao: confirma cursorAplicado apos commit local.
- POST /api/v1/sync/vendas: pedido/itens/pagamentos completos, conforme contrato SaleV1.
- POST /api/v1/sync/vendas/:uid/cancelamento: cancelamento idempotente do mesmo PDV.

RefreshToken expira em 90 dias; somente seu SHA-256 fica no banco. A renovacao
preserva a credencial para permitir repeticao apos perda de resposta. Rotacao ou
desativacao invalida refresh e JWT anteriores. Credencial deve ser guardada
no armazenamento seguro do dispositivo na integracao futura.

Paginas nao confirmadas sao reenviadas. UUID e imutavel; codigo pode mudar.
Exclusoes logicas/fisicas geram tombstones. Precos respeitam inteiro seguro de
centavos no contrato JSON. Contador transacional serializa publicadores.
Nao remover eventos sem definir retencao e ressnapshot por dispositivo.

test:integration exige API_TEST_DATABASE=isolated-local e PostgreSQL descartavel
em 127.0.0.1:55439/livraria_test, container livraria-separacao-db.
Esse teste apaga apenas o schema do banco isolado e rejeita URLs diferentes.
Tambem aplica todas as migrations historicas para validar os gatilhos reais.
API_NATIVE_E2E=true inclui o adapter Rust HTTP, com Cargo instalado e target pronto.
Ensaio/provisionamento: specs/013-separacao-pdv-nuvem/pdv-rollout.md.

## Catalogo Administrativo Experimental

GET/POST `admin/livros`, PUT/DELETE `admin/livros/:uid`: admin individual apenas.
Criacao e saldo inicial atomicos; atualizacao preserva UUID; exclusao publica tombstone.
Precos em centavos inteiros, conflito de codigo retorna 409, listagem paginada por UUID.
Web opt-in com `API_CATALOGO_ENABLED=true` e `NUVEM_API_URL` apenas no servidor.
Detalhes: `specs/013-separacao-pdv-nuvem/catalogo-web-rollout.md` na raiz.

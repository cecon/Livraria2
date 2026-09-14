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

# API da nuvem

Na raiz: npm run dev:api. Health: http://127.0.0.1:3001/api/v1/health.

DATABASE_URL deve vir do ambiente seguro. Nunca versionar credenciais.
db:validate e db:generate nao modificam banco. db:introspect le o schema existente.
O mapeamento Livro e inicial, baseado no SQL historico; conferir o banco real
antes de implementar repositorios. Nao executar db push/reset.

Ainda nao substitui a sincronizacao Supabase. Plano e tarefas:
specs/013-separacao-pdv-nuvem.

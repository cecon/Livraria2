# Plano: PDV e nuvem

## Stack e estrutura

- apps/pdv: React/Vite, Tauri, SQLite/SeaORM.
- apps/nuvem/api: NestJS 11, Prisma 6, PostgreSQL existente.
- apps/nuvem/web: Next.js administrativo existente.
- apps/nuvem/migrations e migrator: SQL historico preservado.
- packages/contratos: contratos de comunicacao versionados.
- crates/livraria-domain: dominio Rust puro compartilhado.

Prisma 6 e fixado por compatibilidade com a integracao inicial CommonJS. Atualizar
major separadamente, com seus adapters/configuracao correspondentes.

## Limites

PDV possui venda, caixa, pagamentos e armazenamento offline. Nuvem possui catalogo,
preco e administracao. Contratos compartilham dados de fronteira, nunca entidades ORM.
API futura valida JWT, perfil e identidade do dispositivo em cada operacao.

## Migracao

1. Marco Git da main e worktree isolado; nao incluir segredos nem alterar producao.
2. Relocar fontes e corrigir build, Docker e workflows.
3. Introduzir API de saude e mapeamento ORM inicial.
4. Introspectar banco, conferir constraints/triggers/RLS/views e estabelecer baseline.
   Nao executar db push/reset; SQL historico segue como autoridade ate essa etapa.
5. Implementar autenticacao, diario transacional de eventos, pagina e confirmacao.
   Sequencia deve respeitar ordem de commit: serializar publicadores em transacao;
   BIGSERIAL sozinho nao garante ausencia de eventos perdidos entre commits.
6. Migrar adapter do PDV com ativacao por dispositivo e rollback para caminho legado.
7. Migrar administrativo para API e remover acesso direto somente apos validacao.

## Validacao

Build e testes front PDV; cargo metadata para caminhos; build web; build API e
requisicao HTTP health. Fluxos novos exigem testes de codigo duplicado/trocado,
exclusao, pagina repetida, concorrencia, offline e reconexao.

## Guardrails

Dominio puro, arquivos ate 300 linhas, dinheiro inteiro de centavos, migrations
idempotentes por comando. Nova fronteira HTTP justificada no ADR-0024.

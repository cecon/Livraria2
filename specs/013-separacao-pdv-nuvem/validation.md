# Validacao do marco estrutural

2026-09-14:

- Build React/Vite do PDV: passou.
- Vitest do PDV: 11 testes passaram.
- Cargo metadata: dependencia de dominio resolve no novo caminho.
- Build Next.js administrativo: passou, com tipos e paginas.
- Prisma validate/generate: passou sem conectar ou modificar banco.
- Compilacao NestJS: passou.
- GET /api/v1/health: status ok e contrato versao 1.
- Guardrails dos arquivos alterados e pureza do dominio: passaram.

Build nativo completo/instalador Windows ainda nao executado. No primeiro marco,
novo protocolo, autenticacao e schema real ainda estavam pendentes.

Segunda entrega:

- Introspeccao real de 17 modelos e baseline SQL conferida, somente leitura.
- 7 testes de integracao passaram em PostgreSQL local isolado.
- JWT individual, perfil atualizado e vinculo de dispositivo validados.
- Renovacao, rotacao/revogacao e limitacao de tentativas validadas.
- Troca 503/ISBN, codigo duplicado, UUID imutavel e limite de centavos validados.
- Exclusao logica/fisica, replay, confirmacao invalida e rollback validados.
- Publicadores concorrentes respeitam ordem de commit.
- T007-T011 e T013 concluidas em ambiente de ensaio.
- Imagem Docker API compilada com dependencias do proprio workspace; Prisma
  gerado consultou o banco isolado a partir da imagem final.

SQL novo nao foi aplicado em producao. Adapter PDV, ingestao idempotente de vendas,
administrativo e ativacao gradual permanecem pendentes.

Terceira entrega:

- API de vendas/pagamentos completos em transacao, recibo/hash por UUID e PDV.
- Cancelamento separado e idempotente com estorno pelos gatilhos reais.
- 14 testes de integracao passaram, incluindo execucao Rust contra NestJS/PostgreSQL.
- 7 novos testes Rust locais e 30 testes existentes de regressao passaram.
- Teste HTTP Rust executado explicitamente no banco isolado: passou.
- Cargo check --tests e build API passaram.
- Outbox preserva snapshots e UUIDs apos perda de resposta.
- Pagina/cursor atomicos e confirmacao apos commit validados com rollback e ack perdido.

T012/T014/T015 concluidas como integracao experimental. Modo hibrido permanece
opt-in; migracao administrativa, cofre de credenciais do dispositivo, instalador
e ativacao gradual ainda pendentes. Nenhum SQL/config de producao alterado.

Quarta entrega (catalogo web):

- Rotas admin/livros com admin individual, UUID estavel e centavos inteiros.
- Produto e movimento de estoque inicial em transacao, com rollback do diario.
- Proxy Next usa cookie HttpOnly, recusa CSRF e nao retorna token ao navegador.
- Flag API_CATALOGO_ENABLED em runtime; modo legado permanece padrao.
- 11 testes de cliente/proxy e 22 testes de integracao passaram.
- Integracao inclui proxy Next real e adapter Rust contra NestJS/PostgreSQL isolados.
- Builds API e web passaram; web compilada com placeholders publicos sem dados reais.
- Caminhos remanescentes apps/escritorio corrigidos no Docker web e dockerignore.
- Imagens Docker web e API experimentais compiladas com sucesso, sem publicar em registry.

T016 concluida como entrega experimental. T017/T018/T019/T020 permanecem abertas.
Login completo com Supabase real, navegador autenticado, proxy publico e ativacao
duradoura ainda precisam de homologacao. Ver catalogo-web-rollout.md.

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

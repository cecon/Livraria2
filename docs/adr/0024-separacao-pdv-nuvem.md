# ADR-0024: Separar PDV e nuvem com API dedicada

Data: 2026-09-14. Status: aceito para implementacao incremental.

## Contexto

A sincronizacao baseada em timestamps/views nao oferece confirmacao por caixa e
complica alteracoes de codigo e exclusoes. Codigo PDV na raiz tambem mistura seus
builds com os do administrativo. Usuario autorizou a separacao e nova stack backend.

## Decisao

PDV em apps/pdv; nuvem em apps/nuvem com web Next.js e API NestJS/Prisma.
PostgreSQL e dominio Rust permanecem. Fronteira HTTP fica na borda, mantendo
offline como invariante e dominio livre de framework/ORM.

Novo protocolo usa sequencia duravel, idempotencia e confirmacao por dispositivo.
Contratos nao dependem de tabelas ORM. Codigo/ISBN nao representa identidade.

## Consequencias

Introducao de backend HTTP e ORM e justificada pela necessidade concreta de
coordenacao e observabilidade de sincronizacao. Evitar servicos adicionais.
Supabase direto e mantido temporariamente; nao considerar a separacao operacional
concluida ate migrar todos os fluxos e testar reconexao/rollback.

Migrations SQL atuais continuam funcionando. Adocao Prisma exige introspeccao
e baseline antes de qualquer alteracao de schema.

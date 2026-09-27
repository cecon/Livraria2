# ADR-0032: Dois produtos, interfaces independentes e API da nuvem

Data da decisão: 2026-09-25. Revisão: 2026-09-27.
Status: aceita; implantação completa ainda precisa ser verificada.
Substitui ADR-0020 e a integração direta descrita na ADR-0015.

## Contexto

O responsável definiu apenas PDV e Cloud, descontinuou Supabase e rejeitou a
obrigação de compartilhar componentes de interface. A estrutura técnica interna
não deve ser apresentada como vários produtos ou como dependência entre suas telas.

## Decisão

- PDV: `apps/pdv`, Tauri/React/Rust/SQLite; interface própria e operação offline.
- Cloud: `apps/nuvem/web` e `apps/nuvem/api`, Next.js/NestJS/Prisma/PostgreSQL.
  Web e API são partes do mesmo produto.
- Interfaces próprias em `apps/pdv/src/interface` e `apps/nuvem/web/interface`.
  Tema comum é referência visual, não pacote obrigatório de UI compartilhada.
- `crates` e `packages` podem conter contratos e cálculos puros justificados;
  não formam terceiro produto nem obrigam compartilhar UI ou persistência.
- Comunicação administrativa e sincronização usam API autenticada. Não existe
  fallback autorizado para Supabase nem acesso direto do navegador ao PostgreSQL.
- Cadastros/ajustes iniciados no PDV gravam na nuvem e exigem conexão/autorização.

## Consequências e implantação

Adaptar servidor antes de publicar clientes dependentes dele. Identidade de máquina
não substitui a do operador/administrador. Conservar dados e fila offline durante falhas.

Em `main`, base `7d0e182`, ainda existem `packages/ui` e referências de runtime ao
provedor descontinuado. A separação local foi trabalhada em `ba1a02c`, mas não integra
essa base publicada. Esta ADR registra a decisão e a pendência, não certifica remoção.
Migrações históricas com checksum permanecem imutáveis.

Auditar a conclusão por dependências, imports, configuração, chamadas de rede e
teste dos dois produtos; não inferir remoção apenas pela ausência de uma tela.

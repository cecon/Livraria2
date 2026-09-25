# ADR-0032: interfaces independentes e comunicacao pela API

Data: 2026-09-25. Status: aceita por orientacao do responsavel pelo projeto.

O PDV e a retaguarda possuem necessidades diferentes. Nao devem depender de um
pacote de interface comum nem obrigar o outro aplicativo a adotar seus menus.

- PDV: `apps/pdv`, componentes em `src/interface`, SQLite para funcionamento offline.
- Retaguarda: `apps/nuvem/web`, componentes em `interface`.
- Servidor: `apps/nuvem/api`, autenticacao, autorizacao e estoque oficial em PostgreSQL.

O pacote `packages/ui` foi removido. Cada aplicacao mantem seus componentes, estilos
e navegacao. O tema visual permanece a referencia, sem acoplamento de implementacao.
Esta decisao substitui a exigencia de interface compartilhada da ADR-0020.
Contratos de comunicacao e calculos de dominio nao sao componentes de interface.

O PDV usa apenas a API autenticada. Operadores, formas de pagamento e destinacoes
sao baixados em paginas por UUID, aplicadas atomicamente e marcadas como recebidas.
Cada rodada percorre todas as referencias, incluindo exclusoes, permitindo retentativa
sem cursor temporal que pule registros. Hashes de senha sao restritos a dispositivos
autenticados para manter a verificacao administrativa offline ja existente.

Nao existe fallback para o provedor de banco descontinuado. Maquinas sem credencial
precisam ser provisionadas pela retaguarda; os dados locais continuam disponiveis offline.
O servidor com o endpoint de referencias deve ser atualizado antes dos novos PDVs.

Migracoes SQL ja aplicadas permanecem imutaveis por verificacao de checksum.
Referencias ao fornecedor antigo em specs e ADRs anteriores sao historicas,
nao instrucoes de configuracao da arquitetura atual.

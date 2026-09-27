# Constituição da Livraria

**Version**: 3.0.0 | **Ratified**: 2026-06-14 | **Last Amended**: 2026-09-27

Esta constituição orienta os dois produtos: **PDV** e **Cloud (nuvem)**. Substitui a
versão 2.0.0, que misturava SQLite local, nuvem como espelho e estoque centralizado.
O [índice de ADRs](../../docs/adr/README.md) distingue decisões vigentes e históricas.
Decisão aprovada não significa implementação ou publicação concluída. Instruções do
responsável prevalecem; mudanças duradouras devem ser refletidas nestes registros.

## I. Dois produtos, responsabilidades claras

| Produto | Localização | Responsabilidade |
|---|---|---|
| PDV | `apps/pdv` | Balcão, interface própria, SQLite e pendências de sincronização |
| Cloud | `apps/nuvem/web` e `apps/nuvem/api` | Retaguarda, API, permissões e PostgreSQL oficial |

Web e API são partes do Cloud. `crates` e `packages` são bibliotecas internas, não
um terceiro produto. Reutilização exige benefício concreto e não obriga compartilhar
interface, navegação, menus ou acesso a banco.

Cada produto mantém sua interface. O tema pode ser referência comum sem pacote de
componentes compartilhado. Supabase foi descontinuado: não introduzir dependência,
fallback, chave ou acesso direto a esse serviço. Referências históricas em migrations
não autorizam uso. A API é a fronteira de acesso aos dados oficiais.

## II. Balcão offline e autoridade da nuvem

O PDV deve registrar vendas, cancelamentos e operações de turno/caixa suportadas
localmente sem internet. SQLite preserva fatos e pendências até confirmação da nuvem.
Funcionamento offline não permite prometer atualização imediata das outras máquinas.

PostgreSQL mantém cadastros, permissões e estoque oficiais. O saldo offline é
operacional: último saldo recebido e fatos locais pendentes. Não é outro razão oficial.
Cadastro, ativação e ajuste iniciados na interface do PDV são operações administrativas
online executadas na nuvem, com autorização no servidor.

## III. Identidade, integridade e sincronização

- UUID estável identifica registros entre sistemas. Código de barras, nome, número
  exibido e horário não substituem a identidade.
- Venda, itens e pagamentos formam uma unidade. Somente venda completa afeta estoque
  oficial, uma vez. Lotes parciais de itens não autorizam baixa parcial.
- Reenvios não duplicam vendas ou movimentos. Mesma identidade com conteúdo diferente
  exige conflito explícito, não sobrescrita silenciosa.
- Cursor representa aplicação e confirmação. Recuperação deve preservar registros e
  permitir reenvio seguro. Rejeições não desaparecem nem confirmam dados não aplicados.
- Dados recebidos não voltam à fila como alterações locais. Máquina não assume a
  identidade de outra; cópia de banco exige conferir provisionamento antes de conectar.

## IV. Estoque, dinheiro e ativação

Dinheiro é inteiro em centavos no contrato e na persistência. Formatação pt-BR é da
interface. Movimentos possuem origem, responsável e referência ao fato; estorno
preserva a trilha original. Correção não apaga histórico.

**Administrador pode ativar produto com saldo zero**, sem criar saldo ou movimento
artificial. Ativação e quantidade são conceitos diferentes. Cadastro novo pode manter
seu padrão documentado de ativação, sem impedir ativação explícita posterior.

Ao incluir título inativo em lançamento, perguntar se deve ativar. Cancelar não ativa
nem inclui; confirmar permite ativação e inclusão na mesma transação. Salvar rascunho
não dá entrada no estoque: finalização é explícita.

A nuvem registra toda quantidade efetivamente vendida, mesmo que gere saldo negativo
para reconciliação; não truncar baixa oficial ao cache do PDV. Inventário registra a
diferença entre contagem física e saldo oficial, protegendo concorrência e reenvio.

## V. Identidade, permissões e segredos

Dispositivo, operador e administrador têm identidades distintas. Token de PDV não é
permissão administrativa. Alteração administrativa exige identidade autenticada e
permissão conferida no servidor. Autenticação offline do operador não autoriza escrita
administrativa na nuvem sem validação online.

Não distribuir credencial administrativa compartilhada ou senha fixa de liberação.
Segredos ficam no Notion do projeto ou ambiente seguro, nunca em Git, `.env` versionado,
bancos ou dumps do repositório. Logs não incluem senhas, tokens ou payloads sensíveis.
Memória de agentes é opcional, não guarda segredos nem concede autorização.

## VI. Arquitetura simples e interfaces independentes

Regras puras são testáveis sem UI, banco ou rede. I/O e ORM ficam nas bordas.
Rust/SeaORM/SQLite atendem ao PDV; NestJS/Prisma/PostgreSQL ao Cloud. Não exigir
reescrever toda regra do servidor em Rust. Contratos e cálculos puros podem ser
reutilizados sem impor UI compartilhada.

KISS, responsabilidade única e necessidade demonstrada orientam abstrações. Arquivos
de lógica/estilo têm limite de 300 linhas significativas, excluindo comentários e
linhas vazias. Exceções precisam de ADR e verificador coerente. Não comprimir código
para contornar contagem nem declarar que hook inexistente protege a regra.

Interfaces usam pt-BR, acessibilidade, responsividade e temas claro/escuro, conforme
`docs/ui-theme-policy.md`. Preservar vocabulário sem tornar nomes antigos de tabela
obrigação de negócio. Falha deve oferecer recuperação, sem tela em branco ou falso sucesso.

## VII. Migrações e publicação verificável

SQLite e PostgreSQL têm migrations próprias. Migração aplicada é imutável; corrigir
com nova migração, preservar checksum e registrar aplicação. O migrador publicado
precisa conter toda estrutura exigida pela API.

Reparo operacional autorizado é restrito, transacional quando aplicável e verificável
antes/depois. Mudança emergencial de schema volta ao código como migração. SQL de
PostgreSQL não se executa no SQLite do caixa.

Publicar migrations aditivas e servidor compatível antes dos clientes. Restrições
incompatíveis só entram depois de comprovar compatibilidade dos clientes em uso.
Publicação identifica commit/imagem, ambiente, verificação e reversão. Hotfix na VM
não substitui integração e imagem oficial.

Teste no Docker local não comprova produção. Saúde HTTP não comprova inclusão,
finalização ou sincronização. Verificar ambiente real e fluxo afetado; não criar
transações fictícias na loja para testar sem autorização.

## VIII. Testes, diagnóstico e governança

Mudanças de dinheiro, estoque, permissão e sincronização exigem testes proporcionais:
rejeição, transação, repetição, concorrência e reconexão quando pertinentes. Documentação
ou alteração visual simples não exige teste que apenas copie a implementação.
Registrar verificações e seus limites.

Diagnóstico distingue etapa, erro, operação/dispositivo e correlação quando disponível.
A interface preserva dados para retentativa. Falta de logs é pendência, não evidência de
sucesso. Não afirmar que a observabilidade está publicada sem verificá-la.

Decisão arquitetural atualiza ADR, constituição e dependentes. Fluxo de especificação
é proporcional ao trabalho. Histórico é preservado, com substituição total ou parcial
explícita. Plano antigo não prevalece sobre decisão posterior.

Versionamento: MAJOR redefine princípios; MINOR acrescenta orientação compatível;
PATCH esclarece. Revisão confere gates do plano, testes pertinentes e publicação real.

## Impacto da versão 3.0.0

Substitui nuvem opcional/espelho, persistência exclusivamente SQLite e UI compartilhada
obrigatória. Consolida dois produtos, estoque oficial, ativação com saldo zero e deploy
verificável. ADR-0032 e ADR-0034 detalham decisões e pendências. Esta revisão documental
não publica por si só a remoção do legado ainda presente no código de produção.

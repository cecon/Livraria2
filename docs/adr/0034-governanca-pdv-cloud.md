# ADR-0034: Governança vigente do PDV e Cloud

Data: 2026-09-27. Status: aceita pela revisão solicitada pelo responsável.
Complementa ADR-0032 e fundamenta a Constituição 3.0.0.
Complementada pela ADR-0037 (Constituição 3.1.0): cadastro pelo canal PDV usa adm técnico.

Complemento em 27/09/2026: a [ADR-0035](0035-deploy-cloud-dokploy.md) define a
publicação da nuvem pelo Dokploy e o gatilho após as imagens no GitHub.

## Contexto

A Constituição 2.0.0 chamava a nuvem de espelho opcional apesar de centralizar o
estoque. ADRs de integração antiga e UI compartilhada permaneciam marcadas como
vigentes. Incidentes mostraram diferença entre código local, imagens da VM e schema
publicado: faltou a tabela de operações do PDV; rotas dinâmicas foram interceptadas;
a tela oferecia título inativo que a API recusava; ativação exigia estoque positivo.

## Decisão

1. Apenas dois produtos. SQLite opera o balcão; PostgreSQL registra os dados oficiais.
   A nuvem é necessária à administração e convergência, sem impedir venda offline.
2. Estoque oficial incorpora vendas completas atomicamente e sem duplicidade.
   Cadastro, turno, operador e máquina têm identidades estáveis distintas.
3. Ativação administrativa não exige saldo positivo e não cria movimento de estoque.
   Inclusão de título inativo pergunta se deve ativar; confirmação e inclusão são
   transacionais. Rascunho não movimenta estoque; finalização é explícita.
4. Autorização administrativa identifica o usuário no servidor. Operações iniciadas
   no PDV não ganham autoridade administrativa apenas pela identidade da máquina.
5. Migração, API e cliente são publicados em ordem compatível. Toda estrutura usada
   pela API deve estar no migrador oficial. Hotfix precisa voltar ao código e à imagem.
6. Não confundir saúde do serviço, teste local, teste de fluxo e validação na loja.
   Relatar precisamente o que foi verificado; preservar pendências e dados em falhas.
7. ADR antiga é histórica ou parcialmente vigente conforme seu escopo, não uma
   instrução para reintroduzir integração removida. Contradição se resolve por decisão
   posterior explícita e atualização dos índices/templates.

## Evidências e estado de implementação

| Assunto | Evidência | Estado nesta revisão |
|---|---|---|
| Lançamentos/rotas/ativação | PR #53, commit `7d0e182` | Integrado à main e imagens oficiais publicadas na VM em 27/09 |
| Operações administrativas do PDV | `migrations/0024_produto_operacao_pdv.sql` | Migração versionada; aplicada na VM em 26/09 |
| Estoque zero | `books.service.ts`, `pdv-products.service.ts` e testes | Ativação explícita aceita, sem movimento artificial |
| Interfaces independentes | ADR-0032, trabalho local `ba1a02c` | Separacao de componentes ainda pendente |
| Transporte exclusivo pela API | ADR-0039 | Remocao implementada; publicacao exige verificar Cloud e PDV |
| Diagnóstico e indicador de sincronização | Alterações locais ainda não integradas | Não declarar logs completos como publicados |
| Renomeação comercial de tabelas | ADR-0030 | Proposta incremental, não pressupor tabelas renomeadas |

Os nomes acima identificam arquivos em `apps/nuvem/api` quando não qualificados.
Estado é um registro datado, não substitui verificar o commit e a imagem em execução.

## Consequências

Constituição, AGENTS/CLAUDE, política de UI e templates passam a usar os mesmos
limites de responsabilidade. Reutilização de domínio existente pode continuar;
interfaces não voltam a ser acopladas por essa razão. Não alterar schema ou runtime
para fingir conformidade durante esta revisão documental.

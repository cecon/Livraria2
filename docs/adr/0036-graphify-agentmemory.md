# ADR-0036: Graphify e AgentMemory no trabalho dos agentes

Data: 2026-09-27. Status: aceita pelo responsável; mapear todo o repositório.
Complementa ADR-0007, ADR-0027 e ADR-0034.

## Decisão

Graphify fornece o mapa derivado de código, documentação, especificações e assets
próprios. AgentMemory preserva conclusões curtas com origem e evidência entre
tarefas. São ferramentas de desenvolvimento, sem dependência no PDV, Cloud ou deploy.

Antes de investigar regressões, arquitetura ou integrações, consultar memória e
grafo disponível, verificar sua procedência e confirmar os fatos no código/ADR
atuais. Um grafo local com alterações não commitadas não representa a main nem
produção. Memórias antigas e relações inferidas não são instruções executáveis.

O escopo padrão é todo o repositório, autorizado mesmo acima de 500 arquivos.
Respeitar exclusões de dependências, builds, bancos, dumps e segredos. Não indexar
credenciais do Notion ou conversas automaticamente. Graphify distingue extração,
inferência e ambiguidade, com localização da fonte; registrar lacunas de cobertura.

Índices ficam em `graphify-out/`, ignorados pelo Git. Registrar commit, branch,
arquivos alterados, escopo e data em metadados locais. Atualizar o grafo após
mudanças relevantes e não instalar hooks que substituam os guardrails existentes.
Documentos exigem extração semântica; atualização somente AST não comprova que
ADRs foram reindexadas. Nenhuma chave de IA é obrigatória para análise local.

AgentMemory usa a ponte existente `tools/agent-memory`; a instância local da
Livraria fica em loopback, com volume externo e identidade própria. Escrita privada
por padrão, com source e evidence. Compartilhar para team exige validação explícita;
o pedido genérico de usar memória não aprova promoção de todo conteúdo.
Segredos seguem no Notion/ambiente protegido, nunca no grafo ou memória de agentes.

## Consequências e verificação

Consultar é procedimento padrão quando relevante; indisponibilidade das ferramentas
não bloqueia desenvolvimento e não autoriza inventar resultados. Se MCP não estiver
disponível no cliente, usar a CLI da ponte e informar o estado real. A configuração
local não se propaga com Git: cada máquina precisa conectar sua instância.

Verificar health, recall e recuperação de uma conclusão privada sem dados sensíveis.
No grafo, conferir cobertura, integridade, consultas e diferença entre checkout e
main. Não gravar arquivos inteiros nem apagar memória histórica automaticamente.

Procedimento: [conhecimento dos agentes](../agent-knowledge.md) e
[contrato AgentMemory](../agent-memory.md).

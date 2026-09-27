# Graphify e AgentMemory

Decisão: [ADR-0036](adr/0036-graphify-agentmemory.md). O grafo mostra relações do
repositório; memória guarda conclusões com evidência. Código e ADRs atuais prevalecem.

## Graphify

A skill `graphify` está instalada neste computador. Usar a skill para construir o
mapa completo, incluindo código, documentos e imagens próprias; não limitar a uma
subpasta por padrão. Escopo completo acima de 500 arquivos foi autorizado.
`.graphifyignore` e `.gitignore` excluem segredos, dados e saídas geradas.

Saídas locais: `graphify-out/graph.json`, `GRAPH_REPORT.md` e `graph.html`.
O relatório deve apresentar contagens, inferências, integridade, cobertura e custo
observado; se a ferramenta não fornece consumo de tokens, informar indisponibilidade.
Guardar commit, branch, dirty files e data em `graphify-out/snapshot.json`.
Revalidar esses metadados antes de usar o mapa como contexto de outra revisão.

Exemplos na raiz do checkout com grafo disponível:

```sh
graphify query "sync catalog cursor" --budget 1500
graphify path "ApiClient" "CatalogService"
graphify explain "CatalogService"
```

Usar nomes realmente presentes no grafo; resultados vazios não comprovam ausência
de implementação. Sem CLI no PATH, usar o Python indicado em
`graphify-out/.graphify_python` com `-m graphify`.
No Windows, chamadas Python que usam multiprocessing devem ficar em arquivo com
`if __name__ == '__main__':`, ou usar `parallel=False`; stdin pode falhar no spawn.

Para mudar código, consultar o grafo e confirmar a fonte; depois atualizar o mapa.
A skill `graphify --update` inclui o fluxo de documentos. `graphify update .`
somente estrutural não substitui revisão semântica de ADRs e specs.
Não instalar hooks automáticos sobre `.githooks` sem preservar os guardrails.

## AgentMemory

A ponte e os comandos já existem; não criar outro banco no repositório.
Provisionamento e variáveis: [agent-memory.md](agent-memory.md).
`.env` local ignorado contém a conexão protegida; não copiar esse arquivo entre
worktrees sem necessidade, nem imprimir seu conteúdo. Segredos duradouros: Notion.

```sh
npm run memory:health
npm run memory:recall -- "sincronizacao catalogo"
```

No cliente com MCP disponível, usar `memory_health`, `memory_recall` e
`memory_remember`. Sem ferramentas MCP expostas, a CLI exerce a mesma ponte.
O arquivo `.mcp.json` só é utilizado por clientes que suportam essa configuração;
sua presença não prova que a sessão atual carregou as ferramentas.

Registrar uma conclusão curta, privada, com referência ao commit/PR/ADR e evidência.
Nunca copiar banco, arquivos inteiros, dados da loja ou credenciais. Memória antiga
pode contradizer a separação das interfaces; seguir ADR-0032 e a implementação atual.
Não promover para team nem excluir histórico sem validação explícita.

## Fluxo de trabalho

1. Identificar checkout, revisão e alterações locais.
2. Consultar memória e mapa relevante; confirmar fontes atuais.
3. Executar o trabalho e validar o comportamento.
4. Atualizar grafo afetado e salvar somente conclusões reutilizáveis em memória privada.
5. Informar limitações: indisponível, desatualizado, parcial ou ainda não confirmado.

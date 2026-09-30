<!-- SPECKIT START -->
Governanca vigente: `.specify/memory/constitution.md` (3.1.1), `AGENTS.md` e
`docs/adr/README.md`. ADR-0032 define dois produtos e interfaces independentes;
ADR-0034 consolida responsabilidades, estoque, permissoes e publicacao.

PDV: `apps/pdv`, offline com SQLite. Cloud: `apps/nuvem/retaguarda` + `apps/nuvem/api`,
PostgreSQL oficial. Bibliotecas internas nao sao outro produto. Sincronizacao
exclusivamente pela API, conforme ADR-0039; nao reintroduzir o transporte antigo.
Planos de features anteriores sao historicos e nao substituem a governanca atual.
Nao confundir alteracao local, imagem oficial e versao executando na VM.
Deploy Cloud: `docs/adr/0035-deploy-cloud-dokploy.md`, `docs/deploy-dokploy.md` e
`.claude/skills/deploy-nuvem-livraria/SKILL.md`. GitHub constroi imagens e solicita
ao Dokploy a publicacao; verificar a conclusao e preservar o banco existente.
<!-- SPECKIT END -->

## Memória do projeto (segredos & longa duração)

Graphify e AgentMemory: `docs/agent-knowledge.md` e ADR-0036. O mapa abrange o
repositorio completo; confirmar revisao e fontes. AgentMemory guarda conclusoes
privadas com evidencia. Grafo e memoria nao sao autoridade sobre codigo/ADRs atuais.

Segredos e informações sensíveis de longa duração (senhas, credenciais, IDs de serviço) ficam na
página do Notion — **nunca** neste repositório:
[Memoria_Projeto_Livraria](https://app.notion.com/p/Memoria_Projeto_Livraria-3a30fcc132cf8068ab0dee09d80f9b76).
Nunca copie segredos para código, README, specs ou memórias locais — registre e consulte no Notion.

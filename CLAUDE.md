<!-- SPECKIT START -->
Governanca vigente: `.specify/memory/constitution.md` (3.0.0), `AGENTS.md` e
`docs/adr/README.md`. ADR-0032 define dois produtos e interfaces independentes;
ADR-0034 consolida responsabilidades, estoque, permissoes e publicacao.

PDV: `apps/pdv`, offline com SQLite. Cloud: `apps/nuvem/web` + `apps/nuvem/api`,
PostgreSQL oficial. Bibliotecas internas nao sao outro produto. Supabase esta
descontinuado por decisao; pendencias de remocao em main estao na ADR-0032.
Planos de features anteriores sao historicos e nao substituem a governanca atual.
Nao confundir alteracao local, imagem oficial e versao executando na VM.
<!-- SPECKIT END -->

## Memória do projeto (segredos & longa duração)

Segredos e informações sensíveis de longa duração (senhas, credenciais, IDs de serviço) ficam na
página do Notion — **nunca** neste repositório:
[Memoria_Projeto_Livraria](https://app.notion.com/p/Memoria_Projeto_Livraria-3a30fcc132cf8068ab0dee09d80f9b76).
Nunca copie segredos para código, README, specs ou memórias locais — registre e consulte no Notion.

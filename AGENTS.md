# Contexto de implementacao

Plano atual: specs/013-separacao-pdv-nuvem/plan.md.
Requisitos e tarefas na mesma pasta. Guardrails: .specify/memory/constitution.md.
Decisao de separacao: docs/adr/0024-separacao-pdv-nuvem.md.

PDV e layout: apps/pdv. Nuvem: apps/nuvem/api e apps/nuvem/web.
Comandos npm na raiz delegam aos workspaces; scripts de deploy usam contexto raiz.
Dominio Rust compartilhado em crates; contratos sem ORM em packages/contratos.

Segredos ficam somente na memoria Notion do projeto ou ambiente seguro.
Nunca versionar credenciais, bancos, dumps ou arquivos .env.

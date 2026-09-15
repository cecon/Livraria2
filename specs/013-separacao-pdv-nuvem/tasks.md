# Tarefas

## Marco e estrutura

- [x] T001 Criar tag da base e worktree isolado.
- [x] T002 Mover PDV e layout para apps/pdv.
- [x] T003 Mover escritorio para apps/nuvem/web.
- [x] T004 Ajustar manifests, caminhos Rust, Docker e workflows.
- [x] T005 Introduzir API NestJS, ORM inicial e contratos v1.
- [x] T006 Validar builds, testes existentes e endpoint health.

## Banco e autenticacao

- [x] T007 Introspectar e conferir schema real sem modificar dados.
- [x] T008 Estabelecer baseline que preserve triggers, constraints, views e RLS.
- [x] T009 Validar JWT/perfis e identidade por dispositivo na API.

## Sincronizacao

- [x] T010 Implementar diario transacional com publicacao em ordem de commit.
- [x] T011 Implementar pagina por cursor e confirmacao persistida por PDV.
- [x] T012 Implementar envio idempotente de vendas e pagamentos.
- [x] T013 Testar renomeacao/duplicacao de codigo, exclusao e concorrencia.
- [x] T014 Migrar adapter PDV, aplicar paginas atomicamente e confirmar depois.
- [x] T015 Testar offline, falha parcial e reenvio.

## Administrativo e entrega

- [x] T016 Migrar catalogo web para API (experimental; homologacao e ativacao em T020).
- [x] T017 Migrar demais fluxos administrativos.
- [x] T017a API de fornecedores e formas de pagamento, com autorizacao e testes PostgreSQL isolados.
- [x] T017b Conectar telas de fornecedores e formas a API por chave experimental independente.
- [x] T017c Padronizar identificadores de usuario em minusculas na nuvem e no PDV.
- [x] T017d Migrar gestao de usuarios e destinacoes para a API experimental.
- [x] T017e Migrar estoque, inventario, entradas, turnos, vendas e relatorios administrativos.
- [x] T018 Exibir confirmacao de alteracoes por caixa.
- [x] T019 Integrar alteracoes mobile preservadas no worktree original.
- [ ] T020 Ativar gradualmente com rollback e remover acesso direto legado.
- [x] T020a Publicar imagem independente da API e preparar migrations com ativacao explicita.
- [x] T020b Implementar modo API-only para login, sessao, identidade e troca de senha.
- [x] T020c Validar todos os modulos web em Docker contra API e PostgreSQL isolados.
- [ ] T020d Homologar contra copia dos dados reais, ativar producao e observar sincronizacao.
- [ ] T020e Remover fallbacks Supabase depois da janela de rollback aprovada.

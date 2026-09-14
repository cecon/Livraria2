# Integracao experimental do PDV

API e PDV permanecem desativados para o protocolo novo por padrao.
Nenhuma configuracao de caixa em producao foi alterada.

## Ensaio

Banco PostgreSQL isolado recebe as migrations historicas e api/sql/001 e 002.
API exige API_OPERATIONS_ENABLED=true, DATABASE_URL e API_JWT_SECRET seguros.

No PDV de ensaio:

- NUVEM_API_ENABLED=true.
- NUVEM_API_URL: origem HTTPS, ou http://127.0.0.1:3003 no ensaio.
- NUVEM_PDV_UID: dispositivo registrado por admin na API.
- NUVEM_PDV_REFRESH_TOKEN: credencial de dispositivo, apenas em ambiente seguro.

Env e usado para desenvolvimento. Antes de ativar em caixas instalados, integrar
provisionamento e armazenamento da credencial no cofre do sistema operacional.
Nunca guardar refreshToken no repositorio, specs, logs ou arquivo JSON.

Modo hibrido explicito: usuarios, formas, turnos e demais referencias ainda usam
o adapter Supabase. Catalogo, vendas, itens e pagamentos usam somente a API.
Falha da API nao faz fallback de vendas para Supabase. Seed legado e bloqueado.
Manual e background compartilham trava para evitar ciclos simultaneos.

## Persistencia

m_api_v1 e aditiva/idempotente: outbox e livro_uid no item vendido.
UUID e gravado junto ao registro da venda, antes do commit. Codigo/titulo/preco
do item permanecem snapshots. Trocar codigo depois nao muda o produto vendido.

Outbox congela payload/UUIDs antes do envio. A nuvem recebe venda completa em
transacao, incorpora estoque somente depois dos filhos e guarda recibo por UUID,
hash canonico e dispositivo. Reenvio retorna recibo original. Conteudo divergente
e pedido legado ja existente exigem reconciliacao explicita.

Cancelamento e operacao separada, revogando venda/estoque uma vez. Se acontecer
durante envio, cabecalho permanece pendente e o ciclo seguinte envia cancelamento.
Alteracoes financeiras depois do recebimento nao sao sobrescritas silenciosamente.

Pagina de catalogo e cursor sao commitados juntos. Erro reverte tudo. Se confirmacao
remota falhar depois do commit, o proximo ciclo confirma cursor local antes do pull.
SQLite substituido/perdido exige novo cadastro de dispositivo/ressnapshot; nao
reutilizar cursor confirmado do dispositivo antigo em um banco vazio.

Alias local conflitante e movido para codigo LOCAL-CONFLITO e desativado,
preservando row id/FKs/historico. Nao fundir movimentos de identidades diferentes.
Saldo publicado desconta vendas locais pendentes ativas para manter disponibilidade
conservadora durante operacao offline.

## Validacao

Cargo api_sync_v1 e api_outbox_v1 validam rollback de pagina, perda de ack,
identidade/codigo, fila persistente e cancelamento concorrente ao envio.
API_NATIVE_E2E=true nos testes de vendas executa Rust contra NestJS real em
localhost:3003, incluindo venda recebida cuja resposta se perdeu e reenvio.
Esse ensaio foi executado; testes reais de producao continuam ignorados.

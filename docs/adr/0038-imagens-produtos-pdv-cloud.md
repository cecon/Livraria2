# ADR-0038: Imagens de produtos no Cloud e no PDV

Data: 2026-09-27. Status: aceita; implantação em etapas.

## Contexto

As capas eram iniciais do título. O armazenamento legado não tinha um fluxo
completo de cadastro, publicação e leitura offline. O responsável solicitou
imagens reais na venda, pesquisa, cadastro e listagens dos dois produtos.

## Decisão

- Cada produto tem uma capa opcional, identificada por `livro.capa_uid`.
  O arquivo fica no PostgreSQL existente, em `livro_capa_arquivo`, coberto pelo
  backup do banco. Não depende de Supabase, URLs externas ou disco do container.
- Upload autenticado pelo administrador da web ou pelo canal de um PDV ativo.
  O upload prepara o arquivo; somente salvar o produto altera o vínculo, com
  as permissões e auditoria já existentes. Não muda estoque nem autorização.
- Aceitar JPEG, PNG e WebP estáticos, até 5 MiB e 25 megapixels. Validar o
  conteúdo, corrigir orientação, remover metadados, limitar a 1000 x 1000 e
  converter para WebP até 512.000 bytes. Deduplicar por SHA-256 do resultado.
- A URL por UUID é imutável. Capas são mídia pública de catálogo; leitura por
  UUID dispensa sessão, sem listagem pública dos arquivos. Não usar para
  documentos privados. Substituição cria outro vínculo; arquivos antigos são
  preservados. Não há coleta automática de arquivos sem vínculo nesta etapa.
- A sincronização de catálogo publica `capaUid`. O PDV baixa os bytes em segundo
  plano para SQLite e usa esse cache sem internet. Falhas de imagem não impedem
  venda nem reconhecimento do catálogo; pendências são tentadas novamente.
- Instalações atualizadas recebem um manifesto paginado de referências com cursor
  próprio, sem zerar catálogo ou reenviar vendas. Versões impedem que eventos
  antigos restaurem uma capa removida ou substituam uma referência mais recente.
- Componentes de imagem e upload pertencem a cada aplicação, conforme ADR-0032.
  Preservar proporção da capa; imagem ausente ou inválida usa iniciais do título.

## Compatibilidade e publicação

Migration aditiva e idempotente; recupera apenas referências internas legadas.
Clientes antigos ignoram o novo campo, e edição sem `capaUid` preserva a capa.
Publicar API, migration e web antes do PDV. Reversão da aplicação não deve
remover os arquivos ou restaurar banco. Procedimento Cloud: ADR-0035.

## Verificação

Testes com PostgreSQL isolado verificam upload, formatos, tamanho, autenticação,
deduplicação, troca, remoção, rollback de UUID inválido e estoque preservado.
Testes Rust verificam retomada de download, persistência offline após reabrir
SQLite, bootstrap e precedência de versões. Revisão das telas e seus limites
fica em `docs/theme-reviews`; não confundir IPC simulado com loja real.

## Uso

No cadastro, escolher **Adicionar imagem** ou **Trocar imagem**, aguardar a prévia
e salvar o produto. **Remover imagem** também precisa ser salvo. Cancelar não
altera a imagem do produto. O envio exige internet; no PDV, imagens já baixadas
continuam disponíveis offline. Um produto sem imagem usa as iniciais do título.

# ADR-0037: Cadastro pelo PDV com responsável técnico adm

Data: 2026-09-27. Status: aceita pelo responsável da loja.
Complementa a ADR-0034 e a seção V da Constituição.

## Decisão

Qualquer PDV provisionado e ativo pode criar produtos online usando seu próprio
canal autenticado. O formulário de cadastro não solicita usuário nem senha de
administrador. A API resolve a conta ativa `adm`, com perfil admin, como responsável
técnico pelo cadastro e pelo eventual movimento de estoque inicial. Nenhuma senha
administrativa é distribuída ou embutida no aplicativo.

A identificação técnica não comprova que a pessoa titular de adm executou a ação.
A auditoria `nuvem_produto_operacao` registra o responsável técnico e `pedido.pdvUid`,
obtido do token validado no servidor. Um identificador enviado no corpo não altera
a origem. O reenvio exige a mesma máquina, responsável e conteúdo; não duplica produto
nem estoque. Conta adm ausente, inativa, excluída ou sem perfil admin impede o cadastro.

Esta autorização abrange somente `acao=criar` em `produtos-pdv`. Edição, ativação e
contagem continuam exigindo autenticação administrativa. Token de usuário operador
não ganha privilégios gerais. Clientes antigos continuam usando a autorização
administrativa existente. Novos clientes usam o canal da máquina mesmo se houver
uma tentativa de cadastro pendente. O estoque inicial e a ativação mantêm suas regras.

## Publicação e validação

Publicar a API compatível e conferir adm antes de distribuir o novo PDV. Não há
migração de banco. Validar cadastro, autoria, origem autenticada, reenvio, conflito,
conta indisponível e recusa de edição/contagem pelo token de máquina em banco isolado.
Não criar produtos fictícios em produção para testar.

Para revogar esta exceção, primeiro distribuir cliente compatível com autorização
administrativa. Removê-la no servidor antes disso faz novos cadastros retornarem 403.

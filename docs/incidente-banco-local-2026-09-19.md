# Verificação de integridade na abertura do PDV

Durante a reabertura para mostrar o card de Produtos, o SQLite local recusou o esquema:
`malformed database schema (pedido) - table "pedido" already exists`.
O ajuste visual não contém alteração de migration.

## Evidências e limites

- Arquivo preservado antes de tentar recuperação. Catálogo interno com entradas duplicadas
  inclusive no mesmo rowid. Verificação de integridade falha fora da aplicação.
- Recuperação em cópia com a ferramenta oficial SQLite produziu banco legível, mas incompleto.
- Backup íntegro anterior existe. Registros operacionais recuperáveis coincidem com ele;
  isso não prova a ausência de operações em páginas irrecuperáveis.
- Cópias do aplicativo em LocalAppData e Program Files. A instalação local por NSIS coexistia
  com uma segunda instância, e o latest.json publicado apontava para MSI.
- Não foi estabelecida relação causal entre a duplicidade de instalações e a corrupção.
  Não atribuir a corrupção às migrations sem reprodução e evidência.

## Proteções implementadas

- Plugin oficial single-instance registrado antes dos demais plugins e da abertura do banco.
- `quick_check` antes de iniciar migrations; falha bloqueia escrita e pede recuperação.
- Mensagem de erro não promete rollback global nem integridade de dados que não foi verificada.
- Workflow do updater configurado com preferência por NSIS para próximas publicações,
  coerente com a instalação por setup.exe. Releases anteriores continuam com seu manifesto.
- Release executa testes de migrations/integridade antes da publicação assinada.

## Validação

`migration_upgrade_copy` copia o snapshot informado para um diretório temporário, executa
três inicializações completas e compara vendas, itens, pagamentos e turnos, além de
`integrity_check` a cada execução. O snapshot original nunca é aberto para escrita.
Executado com sucesso sobre o backup local. Fixture adicional confirma que falha de
integridade impede a criação das tabelas de migration. Testes de schema novo e catálogo
continuam passando.

Na instalação local protegida, a abertura do arquivo danificado foi bloqueada e seu hash
permaneceu inalterado. Uma segunda instância encerrou sem abrir outro caixa. A cópia antiga
em Program Files ainda não recebeu essa proteção; o Windows negou a substituição do executável.

## Recuperação local executada

Após a instrução explícita para recuperar o banco localmente, foi restaurado o backup íntegro
das 20h13, mantendo o original danificado e a extração parcial em diretório separado. Todos
os registros legíveis extraídos foram comparados nas colunas comuns com o backup: nenhuma
divergência. Não foi usada a nuvem como fonte de recuperação.

O aplicativo instalado respondeu `estado_boot.ok = true`. A verificação de integridade
retornou `ok`; a venda, seus dois itens, pagamento e 26 turnos coincidem com o backup nos
campos operacionais. O catálogo local contém 516 produtos. A página Produtos abriu com
20 resultados e sem alerta de erro. Há um turno aberto pertencente a esta máquina no
estado restaurado; não foi alterado para simular um fechamento desconhecido.

A recuperação não comprova inexistência de operações posteriores nas páginas irrecuperáveis.
Recuperação automática permanente a partir de backups ainda não está implementada; as
proteções atuais verificam integridade e bloqueiam segunda instância.

Referências: [single-instance Tauri](https://v2.tauri.app/plugin/single-instance/) e
[opções do tauri-action](https://github.com/tauri-apps/tauri-action).

# Verificação de integridade na abertura do PDV

Durante a reabertura para mostrar o card de Produtos, o SQLite local recusou o esquema:
`malformed database schema (pedido) - table "pedido" already exists`.
O ajuste visual não contém alteração de migration.

## Evidências e limites

- Arquivo preservado antes de tentar recuperação. Catálogo interno com entradas duplicadas
  inclusive no mesmo rowid. Verificação de integridade falha fora da aplicação.
- Recuperação em cópia com a ferramenta oficial SQLite produziu banco legível, mas incompleto.
- Backup íntegro anterior existe. Registros operacionais recuperáveis coincidem com ele;
  isso não prova a ausência de operações em páginas irrecuperáveis. Recuperação do caixa
  depende de esclarecer se houve operação posterior ao horário do backup.
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

Referências: [single-instance Tauri](https://v2.tauri.app/plugin/single-instance/) e
[opções do tauri-action](https://github.com/tauri-apps/tauri-action).

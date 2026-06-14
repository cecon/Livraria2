# Deploy & Auto-update (Windows)

Distribuição via **GitHub Actions + Tauri updater** (assinado). Repo público em
`github.com/cecon/Livraria2`.

## Como funciona

- **Todo push na `main`** dispara o workflow [`.github/workflows/release.yml`](../.github/workflows/release.yml):
  1. Define a versão automaticamente: `0.1.<número-da-execução>`.
  2. Compila o app para **Windows** (instalador NSIS), **assina** os artefatos de update.
  3. Publica um **GitHub Release** com o instalador + o `latest.json`.
- O app instalado, ao abrir, consulta
  `https://github.com/cecon/Livraria2/releases/latest/download/latest.json`,
  compara a versão e, se houver nova, mostra um aviso **"Atualização disponível"**.
  Ao confirmar, baixa, instala e reinicia.

## Primeira instalação (manual, uma vez por máquina)

1. Vá em **Releases** do repositório e baixe o instalador `.exe` (NSIS) da versão mais recente.
2. Instale no balcão. A partir daí, as próximas versões chegam **automaticamente**.

## Publicar uma nova versão

Basta **editar e dar push na `main`**. O CI cuida do resto. Acompanhe em **Actions**.
(Também dá para disparar manualmente em Actions → release → *Run workflow*.)

## ⚠️ Backup da chave de assinatura (CRÍTICO)

A chave **privada** de assinatura do updater está:

- No GitHub como secrets: `TAURI_SIGNING_PRIVATE_KEY` e `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
- Localmente em `~/.tauri/livraria2.key` (privada) e `~/.tauri/livraria2.password` (senha).

**Faça backup desses dois arquivos em local seguro.** Se a chave for perdida, não será
possível publicar atualizações que os clientes já instalados aceitem (eles verificam a
assinatura contra a chave pública embutida no app) — seria preciso reinstalar todos manualmente.
A chave **pública** correspondente está em `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`).

## Assinatura do instalador (opcional, futuro)

O instalador Windows **não** é assinado com certificado de código (Authenticode), então o
SmartScreen pode exibir um aviso na primeira instalação. Para remover, é preciso um certificado
de assinatura de código (pago) configurado como secret. O **auto-update** funciona mesmo sem isso.

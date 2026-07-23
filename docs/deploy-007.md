# Deploy da sincronização com a nuvem (feature 007)

## São **dois** artefatos com naturezas diferentes — só um vira container

| Parte | Stack | Como "deploya" |
|---|---|---|
| **PDV** (balcão) | React/Vite **dentro do Tauri** | **App desktop** — `npm run tauri build` gera um instalador (`.msi`/`.exe`/`.dmg`) que roda no **notebook**. **NÃO** é imagem Docker, **NÃO** vai pro Swarm. |
| **Escritório** (retaguarda) | **Next.js** | **Imagem Docker** → serviço no **Portainer Swarm**. |

> Ou seja: **uma imagem só** (o Next.js). O React do PDV é parte do desktop Tauri.

---

## 1) Escritório (Next.js) → imagem → Swarm

### 1.1 Build da imagem
As `NEXT_PUBLIC_*` são embutidas **no build** (bundle do cliente), então vão como `--build-arg`.
O Escritório agora consome os pacotes do workspace (`@livraria/ui`, `@livraria/domain`), então
o build roda **da raiz do repositório** (contexto = raiz) com `-f apps/escritorio/Dockerfile` (feature 008):

```bash
# na RAIZ do repositório (não em apps/escritorio)
docker build -f apps/escritorio/Dockerfile \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://fiqzcnnibwzthhjatxvq.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key-do-Notion> \
  -t livraria-escritorio:latest .
```

### 1.2 Disponibilizar a imagem para o Swarm
Serviços de Swarm **puxam** a imagem — não a constroem. Escolha:

- **Swarm de 1 nó** (comum): a imagem local já basta. Deploy direto.
- **Swarm multi-nó**: envie para um registry (Docker Hub, registry privado, ou o registry do Portainer):
  ```bash
  docker tag livraria-escritorio:latest <registry>/livraria-escritorio:latest
  docker push <registry>/livraria-escritorio:latest
  ```
  e troque a `image:` no `stack.yml` para `<registry>/livraria-escritorio:latest`.

### 1.3 Subir o stack no Portainer
Portainer → **Stacks → Add stack** → cole `apps/escritorio/stack.yml` (ajuste `image:` se usou registry) → **Deploy**.
O serviço sobe na porta **3000**.

### 1.4 Domínio + HTTPS
O escritório escuta na 3000 (HTTP). Publique atrás do seu **reverse proxy** (Traefik/nginx do Portainer):
- exponha, ex., `escritorio.sualivraria.com.br` → `escritorio:3000`;
- com Traefik, adicione as labels no `stack.yml` (host rule + entrypoint websecure + certresolver).

### 1.5 Usuários do escritório (Supabase Auth)
A tela de login usa contas do **Supabase Auth**. Crie as contas da equipe:
Supabase → **Authentication → Users → Add user** (marque *Auto Confirm*), com e-mail/senha.
Cada operador da retaguarda entra com a sua conta.

---

## 2) PDV (Tauri desktop) → instalar no notebook

```bash
# na máquina de build (mesmo SO do notebook)
npm install
npm run tauri build      # gera o instalador em src-tauri/target/release/bundle/
```
Instale o pacote gerado no notebook do balcão.

### 2.1 Config do sync no PDV (env **ou** arquivo — resolvido)
O PDV lê a config da nuvem de **variáveis de ambiente** (dev) **ou** de um arquivo
**`sync.json`** na pasta de config do app (produção). As env têm prioridade.

- **Dev**: `export SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_PDV_EMAIL=... SUPABASE_PDV_SENHA=...` e `npm run tauri dev`.
- **Desktop instalado**: crie o `sync.json` (modelo em `docs/sync.example.json`) em:
  - **Windows**: `%APPDATA%\<bundle-id>\sync.json`
  - **macOS**: `~/Library/Application Support/<bundle-id>/sync.json`
  - **Linux**: `~/.config/<bundle-id>/sync.json`

  (`<bundle-id>` = `identifier` do `src-tauri/tauri.conf.json`.)

Sem env nem arquivo, a sincronização apenas não roda (o PDV segue 100% offline).
Credenciais do usuário de serviço do PDV: **Memória do Projeto (Notion)**.

---

## Checklist de deploy
- [ ] Contas do escritório criadas no Supabase Auth
- [ ] Imagem do Next.js buildada (com as `--build-arg`)
- [ ] (multi-nó) imagem no registry + `stack.yml` apontando pra ela
- [ ] Stack no Portainer no ar (porta 3000) + reverse proxy/HTTPS
- [ ] Instalador do PDV gerado (`tauri build`) e instalado no notebook
- [ ] `sync.json` criado na pasta de config do PDV (modelo: `docs/sync.example.json`)

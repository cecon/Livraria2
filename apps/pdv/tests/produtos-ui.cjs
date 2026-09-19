const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const mobile of [false, true]) for (const dark of [false, true]) {
      const p = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 } });
      p.setDefaultTimeout(12000);
      const errors = []; p.on("pageerror", e => errors.push(e.message));
      await p.addInitScript(({ dark }) => {
        localStorage.setItem("eldl-theme", dark ? "dark" : "light");
        window.fixture = { writes: [], products: [], active: true };
        const book = r => ({ codigo: r.codigo, titulo: r.titulo, precoCentavos: r.precoCentavos, estoque: r.saldoPublicado });
        const result = r => ({ produto: r, livro: r.ativo ? book(r) : null, pendenteLocal: false });
        window.__TAURI_INTERNALS__ = { transformCallback: () => 1, invoke: async (cmd, args) => {
          const f = window.fixture;
          if (cmd === "estado_boot") return { ok: true };
          if (cmd === "estado_maquina") return { configured: true, nome: "Teste" };
          if (cmd.includes("get_version")) return "teste";
          if (cmd === "turno_aberto") return f.active ? { syncUid: "teste", operador: "fixture", caixaInicialCentavos: 0, abertura: "2026-09-19T12:00:00" } : null;
          if (cmd === "listar_operadores") return [{ usuario: "fixture", nome: "Operador teste" }];
          if (cmd === "proximo_numero_pedido") return 1;
          if (cmd === "listar_formas_ativas") return [{ id: 1, chave: "dinheiro", rotulo: "Dinheiro", ativa: true }];
          if (cmd === "status_sincronizacao") return { pendentes: 0 };
          if (["buscar_por_texto", "vendas_do_turno", "caixa_movimentos_listar"].includes(cmd)) return [];
          if (cmd === "livro_por_codigo") return null;
          if (cmd === "produtos_listar") return f.products;
          if (cmd === "produto_consultar") { const r = f.products.find(r => r.codigo === args.codigo || r.uid === args.uid); return r ? result(r) : null; }
          if (cmd === "produto_salvar") {
            const d = args.pedido; f.writes.push(d);
            let r = f.products.find(r => r.uid === d.uid);
            if (d.acao === "criar") {
              r = { uid: d.uid, codigo: d.dados.codigo, titulo: d.dados.titulo, precoCentavos: d.dados.preco_centavos,
                saldoPublicado: d.dados.estoqueInicial, autor: "", descricao: "", categoria: 0, ativo: true, versao: "1" };
              f.products.push(r);
            } else if (d.acao === "contar") r.saldoPublicado = d.quantidade;
            else { r.titulo = d.dados.titulo; r.precoCentavos = d.dados.preco_centavos; }
            r.versao = String(Number(r.versao) + 1); return result(r);
          }
          return null;
        } };
      }, { dark });
      const navigate = async name => {
        if (mobile) { const toggle = p.getByRole("button", { name: /Abrir ou recolher menu/ }); if (await toggle.count()) await toggle.first().click(); }
        await p.locator("aside").first().getByRole("link", { name, exact: true }).click();
      };
      await p.goto("http://localhost:1420");
      await p.getByRole("link", { name: "Encerrar turno", exact: true }).waitFor();
      await navigate("Venda");
      await p.getByPlaceholder("Código, título ou autor").fill("3*");
      await p.getByPlaceholder("Código, título ou autor").fill("9781234567890");
      await p.getByRole("button", { name: "Adicionar", exact: true }).click();
      await p.getByRole("dialog").waitFor();
      assert.equal(await p.getByRole("button", { name: "Cancelar", exact: true }).evaluate(e => e === document.activeElement), true);
      await p.getByRole("button", { name: "Cancelar", exact: true }).click();
      assert.equal(await p.evaluate(() => window.fixture.writes.length), 0);
      await p.getByPlaceholder("Código, título ou autor").fill("9781234567890");
      await p.getByRole("button", { name: "Adicionar", exact: true }).click();
      await p.getByRole("button", { name: "Sim, cadastrar" }).click();
      assert.equal(await p.getByLabel("Código de barras (EAN/ISBN)").inputValue(), "9781234567890");
      await p.getByLabel("Título", { exact: true }).fill("Livro integrado");
      assert.equal(await p.evaluate(() => document.documentElement.classList.contains("dark")), dark);
      assert.ok(await p.getByRole("dialog").evaluate(e => e.scrollWidth <= e.clientWidth));
      if (process.env.UI_SCREENSHOTS) await p.screenshot({path: `${process.env.UI_SCREENSHOTS}/produtos-${mobile ? "mobile" : "desktop"}-${dark ? "dark" : "light"}.png`});
      await p.getByLabel("Preço (R$)", { exact: true }).fill("12,90");
      await p.getByLabel("Estoque inicial").fill("10");
      await p.getByLabel("Usuário", { exact: true }).fill("admin-teste");
      await p.getByLabel("Senha", { exact: true }).fill("senha-sintetica");
      await p.getByRole("button", { name: "Salvar e adicionar à venda" }).click();
      await p.getByRole("dialog").waitFor({ state: "hidden" });
      await p.getByText("Títulos: 1 · Itens: 3", { exact: true }).waitFor();
      assert.equal(await p.evaluate(() => window.fixture.writes.length), 1);
      await p.getByLabel("Cliente", { exact: true }).fill("Cliente de teste");
      await p.getByRole("button", { name: /38,70/ }).click();
      await navigate("Produtos");
      await p.getByRole("button", { name: "Editar", exact: true }).click();
      await p.getByLabel("Título", { exact: true }).fill("Título revisado");
      await p.getByRole("button", { name: "Ajustar estoque", exact: true }).click();
      await p.getByLabel("Quantidade física contada").fill("7");
      await p.getByLabel("Usuário", { exact: true }).fill("admin-teste");
      await p.getByLabel("Senha", { exact: true }).fill("senha-sintetica");
      await p.getByRole("button", { name: "Confirmar ajuste" }).click();
      await p.getByRole("heading", { name: "Editar produto", exact: true }).waitFor();
      assert.equal(await p.getByLabel("Título", { exact: true }).inputValue(), "Título revisado");
      assert.equal(await p.getByLabel("Senha", { exact: true }).inputValue(), "");
      await p.getByLabel("Senha", { exact: true }).fill("senha-sintetica");
      await p.getByRole("button", { name: "Salvar", exact: true }).click();
      await p.getByRole("dialog").waitFor({ state: "hidden" });
      await p.getByText("Título revisado", { exact: true }).waitFor();
      await navigate("Venda");
      await p.getByText("Títulos: 1 · Itens: 3", { exact: true }).waitFor();
      assert.equal(await p.getByLabel("Cliente", { exact: true }).inputValue(), "Cliente de teste");
      const draft = await p.evaluate(() => JSON.parse(localStorage.getItem("eldl-venda-rascunho")));
      assert.equal(draft.pag[1], 3870);
      assert.equal(await p.evaluate(() => JSON.stringify(localStorage).includes("senha-sintetica")), false);
      assert.deepEqual(errors, []);
      console.log(`PASS produtos/venda ${mobile ? "smartphone" : "desktop"} ${dark ? "dark" : "light"}`);
      await p.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });

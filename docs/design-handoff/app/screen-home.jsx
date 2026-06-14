// ── Home / Dashboard ──────────────────────────────────────────────────────────
function HomeScreen({ books, go }) {
  const totalHoje = PEDIDOS_HOJE.reduce((s, p) => s + Object.values(p.pag).reduce((a, b) => a + b, 0), 0);
  const itensHoje = PEDIDOS_HOJE.reduce((s, p) => s + p.itens.reduce((a, i) => a + i.qtd, 0), 0);
  const ticket = totalHoje / PEDIDOS_HOJE.length;
  const baixo = books.filter((b) => b.estoque > 0 && b.estoque <= 3);
  const esgotado = books.filter((b) => b.estoque <= 0);
  const hora = new Date().getHours();
  const saud = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  const stats = [
    { label: "Vendas de hoje", value: BRL(totalHoje), icon: <Icons.trending size={18}/>, sub: PEDIDOS_HOJE.length + " pedidos" },
    { label: "Itens vendidos", value: itensHoje, icon: <Icons.cart size={18}/>, sub: "no dia de hoje" },
    { label: "Ticket médio", value: BRL(ticket), icon: <Icons.report size={18}/>, sub: "por pedido" },
    { label: "Estoque baixo", value: baixo.length + esgotado.length, icon: <Icons.alert size={18}/>, sub: esgotado.length + " esgotados", tone: (baixo.length + esgotado.length) ? "amber" : "neutral" },
  ];
  const actions = [
    { label: "Nova Venda", desc: "Abrir o PDV", icon: <Icons.cart size={20}/>, to: "venda", brand: true },
    { label: "Cadastrar Livro", desc: "Incluir ou alterar", icon: <Icons.bookPlus size={20}/>, to: "cadastro" },
    { label: "Pesquisar", desc: "Buscar no acervo", icon: <Icons.search size={20}/>, to: "pesquisa" },
    { label: "Relatórios", desc: "Vendas e estoque", icon: <Icons.report size={20}/>, to: "relatorio" },
  ];

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-sm text-zinc-500">{saud}, equipe</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Espaço do Livro — PIB Penha</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Icons.calendar size={15}/> {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-zinc-500">{s.label}</span>
              <span className={cx("rounded-md p-1.5", s.tone === "amber" ? "bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400")}>{s.icon}</span>
            </div>
            <div className="mt-2 font-mono text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{s.value}</div>
            <div className="mt-0.5 text-xs text-zinc-400">{s.sub}</div>
          </Card>
        ))}
      </div>

      {/* actions */}
      <div className="mt-4 grid grid-cols-4 gap-4">
        {actions.map((a) => (
          <button key={a.label} onClick={() => go(a.to)}
            className={cx("group flex items-center gap-3 rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md",
              a.brand ? "border-brand/30 bg-brand/5 hover:bg-brand/10 dark:border-brand/40 dark:bg-brand/10"
                      : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:bg-zinc-900")}>
            <span className={cx("rounded-lg p-2.5", a.brand ? "bg-brand text-white" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300")}>{a.icon}</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{a.label}</div>
              <div className="text-xs text-zinc-500">{a.desc}</div>
            </div>
            <Icons.chevR size={16} className="ml-auto text-zinc-300 transition-transform group-hover:translate-x-0.5 dark:text-zinc-600"/>
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-[1.3fr_1fr] gap-4">
        {/* recent sales */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Pedidos recentes</h3>
            <button onClick={() => go("relatorio")} className="text-xs font-medium text-brand hover:underline">Ver relatório</button>
          </div>
          <div>
            {[...PEDIDOS_HOJE].reverse().map((p) => {
              const tot = Object.values(p.pag).reduce((a, b) => a + b, 0);
              return (
                <div key={p.numero} className="flex items-center gap-3 border-b border-zinc-100 px-4 py-2.5 last:border-0 dark:border-zinc-800/60">
                  <span className="font-mono text-xs text-zinc-400">#{p.numero}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-zinc-700 dark:text-zinc-200">{p.itens[0].titulo}{p.itens.length > 1 ? " +" + (p.itens.length - 1) : ""}</div>
                  </div>
                  <Badge tone="neutral">{p.turno === "manha" ? "Manhã" : "Tarde"}</Badge>
                  <span className="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-50">{BRL(tot)}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* low stock */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-50"><Icons.alert size={15} className="text-amber-500"/> Estoque baixo</h3>
            <button onClick={() => go("cadastro")} className="text-xs font-medium text-brand hover:underline">Repor</button>
          </div>
          <div>
            {[...esgotado, ...baixo].slice(0, 5).map((b) => (
              <div key={b.codigo} className="flex items-center gap-3 border-b border-zinc-100 px-4 py-2.5 last:border-0 dark:border-zinc-800/60">
                <Cover size="sm" titulo={b.titulo} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-zinc-700 dark:text-zinc-200">{b.titulo}</div>
                  <div className="truncate text-xs text-zinc-400">{b.autor}</div>
                </div>
                <StockBadge n={b.estoque} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

Object.assign(window, { HomeScreen });

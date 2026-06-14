// ── Venda / PDV — scanner-first cashier screen ────────────────────────────────
function VendaScreen({ books }) {
  const toast = useToast();
  const [pedidoNum, setPedidoNum] = React.useState(5996);
  const [cliente, setCliente]     = React.useState("CLIENTE");
  const [items, setItems]         = React.useState([]);
  const [pag, setPag]             = React.useState({ cartao: "", dinheiro: "", pix: "", ministerio: "", vale: "" });
  const [bc, setBc]               = React.useState("");
  const [qty, setQty]             = React.useState(1);
  const [q, setQ]                 = React.useState("");
  const bcRef = React.useRef(null);

  React.useEffect(() => { bcRef.current && bcRef.current.focus(); }, []);

  const total = items.reduce((s, it) => s + it.preco * it.qtd, 0);
  const totalItens = items.reduce((s, it) => s + it.qtd, 0);
  const numF = (v) => parseFloat(String(v).replace(",", ".")) || 0;
  const pago = PAGAMENTOS.reduce((s, p) => s + numF(pag[p.key]), 0);
  const restante = Math.max(0, total - pago);
  const troco = Math.max(0, pago - total);

  function addBook(book, n = 1) {
    setItems((prev) => {
      const i = prev.findIndex((x) => x.codigo === book.codigo);
      if (i >= 0) { const cp = [...prev]; cp[i] = { ...cp[i], qtd: cp[i].qtd + n }; return cp; }
      return [...prev, { codigo: book.codigo, titulo: book.titulo, preco: book.preco, qtd: n }];
    });
  }
  function addByBarcode() {
    const code = bc.trim();
    if (!code) return;
    const book = books.find((b) => b.codigo === code);
    if (!book) { toast("Código não encontrado: " + code, "error"); return; }
    if (book.estoque <= 0) { toast(book.titulo + " está esgotado", "error"); return; }
    addBook(book, Math.max(1, qty));
    setBc(""); setQty(1); bcRef.current && bcRef.current.focus();
  }
  const results = q.trim().length < 2 ? [] :
    books.filter((b) => norm(b.titulo + " " + b.autor).includes(norm(q))).slice(0, 6);

  function setItemQty(codigo, qd) {
    setItems((prev) => prev.map((x) => x.codigo === codigo ? { ...x, qtd: Math.max(1, qd) } : x));
  }
  function removeItem(codigo) { setItems((prev) => prev.filter((x) => x.codigo !== codigo)); }
  function quickFill(key) { setPag((p) => ({ ...p, [key]: String(restante.toFixed(2)).replace(".", ",") })); }

  function receber() {
    if (!items.length) { toast("Adicione ao menos um item", "error"); return; }
    if (pago + 0.001 < total) { toast("Pagamento insuficiente — falta " + BRL(restante), "error"); return; }
    toast("Pedido " + pedidoNum + " recebido — " + BRL(total), "success");
    setItems([]); setPag({ cartao: "", dinheiro: "", pix: "", ministerio: "", vale: "" });
    setCliente("CLIENTE"); setPedidoNum((n) => n + 1); setQ("");
    setTimeout(() => bcRef.current && bcRef.current.focus(), 50);
  }
  function apagar() {
    setItems([]); setPag({ cartao: "", dinheiro: "", pix: "", ministerio: "", vale: "" }); setQ("");
    toast("Pedido apagado");
    bcRef.current && bcRef.current.focus();
  }

  const pagIcon = { cartao: <Icons.card size={15}/>, dinheiro: <Icons.money size={15}/>, pix: <Icons.pix size={15}/>, ministerio: <Icons.church size={15}/>, vale: <Icons.gift size={15}/> };

  return (
    <div className="grid h-full min-w-[1040px] grid-cols-[1fr_356px] gap-5 p-5">
      {/* LEFT — order building */}
      <div className="flex min-h-0 flex-col gap-4">
        {/* header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Venda</h1>
            <Badge tone="neutral" className="font-mono">Pedido Nº {pedidoNum}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="cli">Cliente</Label>
            <Input id="cli" value={cliente} onChange={(e) => setCliente(e.target.value)} className="h-8 w-48" />
          </div>
        </div>

        {/* add + search */}
        <Card className="p-4">
          <div className="flex items-end gap-3">
            <div className="w-20">
              <Label>Qtd.</Label>
              <Input type="number" min="1" value={qty} onChange={(e) => setQty(parseInt(e.target.value) || 1)} className="mt-1 text-center font-mono" />
            </div>
            <div className="flex-1">
              <Label>Código de Barras</Label>
              <Input ref={bcRef} value={bc} icon={<Icons.barcode size={16}/>} placeholder="Escaneie ou digite…"
                onChange={(e) => setBc(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addByBarcode()}
                className="mt-1 font-mono" />
            </div>
            <Button variant="default" size="md" onClick={addByBarcode} className="mb-px">
              <Icons.plus size={16}/> Adicionar
            </Button>
          </div>
          <div className="relative mt-3">
            <Label>Pesquisar para o Pedido Nº {pedidoNum}</Label>
            <Input value={q} icon={<Icons.search size={16}/>} placeholder="Título ou Autor"
              onChange={(e) => setQ(e.target.value)} className="mt-1" />
            {results.length > 0 && (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
                {results.map((b) => (
                  <button key={b.codigo} onClick={() => { addBook(b, 1); setQ(""); bcRef.current && bcRef.current.focus(); }}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    <Cover size="sm" titulo={b.titulo} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{b.titulo}</div>
                      <div className="truncate text-xs text-zinc-500">{b.autor}</div>
                    </div>
                    <StockBadge n={b.estoque} />
                    <span className="font-mono text-sm font-semibold text-zinc-700 dark:text-zinc-200">{BRL(b.preco)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* line items */}
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="grid grid-cols-[1fr_96px_128px_100px_52px] items-center gap-2 border-b border-zinc-200 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
            <div>Título</div><div className="text-right">Preço</div><div className="text-center">Quantidade</div><div className="text-right">Total</div><div className="text-center">Remover</div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-zinc-400">
                <Icons.cart size={30} className="opacity-50"/>
                <p className="text-sm">Escaneie um código de barras para começar</p>
              </div>
            ) : items.map((it) => (
              <div key={it.codigo} className="grid grid-cols-[1fr_96px_128px_100px_52px] items-center gap-2 border-b border-zinc-100 px-4 py-2.5 last:border-0 dark:border-zinc-800/60">
                <div className="flex items-center gap-3 min-w-0">
                  <Cover size="sm" titulo={it.titulo} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{it.titulo}</div>
                    <div className="font-mono text-[11px] text-zinc-400">{it.codigo}</div>
                  </div>
                </div>
                <div className="text-right font-mono text-sm text-zinc-600 dark:text-zinc-300">{BRL(it.preco)}</div>
                <div className="flex items-center justify-center gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setItemQty(it.codigo, it.qtd - 1)}><Icons.minus size={14}/></Button>
                  <span className="w-8 text-center font-mono text-sm font-semibold text-zinc-800 dark:text-zinc-100">{it.qtd}</span>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setItemQty(it.codigo, it.qtd + 1)}><Icons.plus size={14}/></Button>
                </div>
                <div className="text-right font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-50">{BRL(it.preco * it.qtd)}</div>
                <div className="flex justify-center">
                  <Button variant="softDestructive" size="icon" className="h-7 w-7" onClick={() => removeItem(it.codigo)}><Icons.x size={14}/></Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* RIGHT — summary + payment */}
      <Card className="flex min-h-0 flex-col overflow-hidden">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Resumo do Pedido Nº {pedidoNum}</h2>
          <div className="mt-1 flex items-center justify-between text-xs text-zinc-500">
            <span>{cliente}</span>
            <span>Títulos: {items.length} · Itens: {totalItens}</span>
          </div>
        </div>

        <div className="flex items-baseline justify-between px-5 py-4">
          <span className="text-sm text-zinc-500">Total do pedido</span>
          <span className="font-mono text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{BRL(total)}</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-y border-zinc-200 bg-zinc-50/60 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-950/40">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Formas de Pagamento</h3>
          <div className="flex flex-col gap-2.5">
            {PAGAMENTOS.map((p) => (
              <div key={p.key} className="grid grid-cols-[1fr_96px_auto] items-center gap-2">
                <Label className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">{pagIcon[p.key]} {p.label}</Label>
                <Input inputMode="decimal" value={pag[p.key]} placeholder="0,00"
                  onChange={(e) => setPag((s) => ({ ...s, [p.key]: e.target.value }))}
                  className="h-8 text-right font-mono" />
                <Button variant="outline" size="sm" className="h-8 px-2 text-[11px]" onClick={() => quickFill(p.key)} disabled={restante <= 0}>
                  {restante > 0 ? "Receber " + BRL(restante) : "—"}
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500">Pago</span>
            <span className="font-mono font-medium text-zinc-700 dark:text-zinc-200">{BRL(pago)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="text-zinc-500">{troco > 0 ? "Troco" : "Restante"}</span>
            <span className={cx("font-mono font-semibold", troco > 0 ? "text-emerald-600 dark:text-emerald-400" : restante > 0 ? "text-amber-600 dark:text-amber-400" : "text-zinc-700 dark:text-zinc-200")}>
              {BRL(troco > 0 ? troco : restante)}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-zinc-200 p-4 dark:border-zinc-800">
          <Button variant="brand" size="lg" onClick={receber} className="w-full text-base">
            <Icons.check size={18}/> Receber
          </Button>
          <Button variant="softDestructive" size="md" onClick={apagar} className="w-full">
            <Icons.trash size={15}/> Apagar Pedido
          </Button>
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { VendaScreen });

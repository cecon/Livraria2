// ── Cadastro / Alterar / Excluir ──────────────────────────────────────────────
function CadastroScreen({ books, setBooks }) {
  const toast = useToast();
  const [lookup, setLookup] = React.useState("");
  const [mode, setMode] = React.useState(null); // null | "novo" | "edit"
  const [form, setForm] = React.useState(null);
  const lookupRef = React.useRef(null);

  React.useEffect(() => { lookupRef.current && lookupRef.current.focus(); }, [mode]);

  const blank = (codigo) => ({ codigo, titulo: "", autor: "", preco: "", categoria: 0, estoque: 0, descricao: "" });

  function abrir() {
    const code = lookup.trim();
    if (!code) { toast("Informe o código de barras", "error"); return; }
    const found = books.find((b) => b.codigo === code);
    if (found) { setForm({ ...found }); setMode("edit"); }
    else { setForm(blank(code)); setMode("novo"); }
  }
  function up(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  function salvar() {
    if (!form.titulo.trim()) { toast("Informe o título", "error"); return; }
    const rec = { ...form, preco: parseFloat(String(form.preco).replace(",", ".")) || 0, estoque: parseInt(form.estoque) || 0, categoria: parseInt(form.categoria) || 0 };
    setBooks((prev) => {
      const i = prev.findIndex((b) => b.codigo === rec.codigo);
      if (i >= 0) { const cp = [...prev]; cp[i] = rec; return cp; }
      return [...prev, rec];
    });
    toast(mode === "novo" ? "Livro cadastrado" : "Alterações salvas", "success");
    setMode(null); setForm(null); setLookup("");
  }
  function excluir() {
    setBooks((prev) => prev.filter((b) => b.codigo !== form.codigo));
    toast("Livro excluído", "success");
    setMode(null); setForm(null); setLookup("");
  }

  if (!mode) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Cadastro de Livros</h1>
        <p className="mt-1 text-sm text-zinc-500">Informe o código de barras para cadastrar, alterar ou excluir um título.</p>
        <Card className="mt-5 p-5">
          <Label>Código de Barras</Label>
          <div className="mt-1.5 flex gap-3">
            <Input ref={lookupRef} value={lookup} icon={<Icons.barcode size={16}/>} placeholder="Escaneie ou digite o código…"
              onChange={(e) => setLookup(e.target.value)} onKeyDown={(e) => e.key === "Enter" && abrir()} className="font-mono" />
            <Button variant="default" onClick={abrir} className="shrink-0"><Icons.chevR size={16}/> Cadastrar / Alterar / Excluir</Button>
          </div>
          <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Cadastrados recentemente</p>
            <div className="flex flex-col gap-1">
              {books.slice(-4).reverse().map((b) => (
                <button key={b.codigo} onClick={() => { setLookup(b.codigo); setForm({ ...b }); setMode("edit"); }}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                  <Cover size="sm" titulo={b.titulo} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-zinc-700 dark:text-zinc-200">{b.titulo}</div>
                    <div className="font-mono text-[11px] text-zinc-400">{b.codigo}</div>
                  </div>
                  <StockBadge n={b.estoque} />
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-5 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => { setMode(null); setForm(null); }}><Icons.chevR size={18} className="rotate-180"/></Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{mode === "novo" ? "Cadastrar novo livro" : "Alterar / Excluir"}</h1>
          <p className="font-mono text-xs text-zinc-400">{form.codigo}</p>
        </div>
        <Badge tone={mode === "novo" ? "green" : "brand"} className="ml-auto">{mode === "novo" ? "Novo registro" : "Editando"}</Badge>
      </div>

      <Card className="p-6">
        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
          <div className="col-span-2">
            <Label>Título</Label>
            <Input value={form.titulo} onChange={(e) => up("titulo", e.target.value)} className="mt-1" placeholder="Nome do livro" />
          </div>
          <div className="col-span-2">
            <Label>Autor</Label>
            <Input value={form.autor} onChange={(e) => up("autor", e.target.value)} className="mt-1" placeholder="Autor" />
          </div>
          <div>
            <Label>Valor (R$)</Label>
            <Input inputMode="decimal" value={form.preco} onChange={(e) => up("preco", e.target.value)} className="mt-1 font-mono" placeholder="0,00" />
          </div>
          <div>
            <Label>Estoque</Label>
            <Input type="number" value={form.estoque} onChange={(e) => up("estoque", e.target.value)} className="mt-1 font-mono" placeholder="0" />
          </div>
          <div className="col-span-2">
            <Label>Categoria <span className="text-zinc-400">(0 = Não Categorizado)</span></Label>
            <select value={form.categoria} onChange={(e) => up("categoria", e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
              {Object.entries(CATEGORIAS).map(([id, nome]) => <option key={id} value={id}>{id} — {nome}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <Label>Descrição</Label>
            <Textarea rows={4} value={form.descricao} onChange={(e) => up("descricao", e.target.value)} className="mt-1" placeholder="Descrição do livro…" />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3 border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <Button variant="brand" onClick={salvar}><Icons.check size={16}/> {mode === "novo" ? "Cadastrar" : "Alterar"}</Button>
          {mode === "edit" && <Button variant="softDestructive" onClick={excluir}><Icons.trash size={15}/> Excluir</Button>}
          <Button variant="ghost" className="ml-auto" onClick={() => { setMode(null); setForm(null); }}>Cancelar</Button>
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { CadastroScreen });

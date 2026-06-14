// ── Pesquisa de Livros + Detalhes ─────────────────────────────────────────────
function PesquisaScreen({ books }) {
  const toast = useToast();
  const [codigo, setCodigo] = React.useState("");
  const [texto, setTexto] = React.useState("");
  const [results, setResults] = React.useState(null);
  const [sel, setSel] = React.useState(null);

  function buscarCodigo() {
    const c = codigo.trim();
    if (!c) return;
    const r = books.filter((b) => b.codigo.includes(c));
    setResults(r); setSel(r.length === 1 ? r[0] : null);
    if (!r.length) toast("Nenhum livro encontrado", "error");
  }
  function buscarTexto() {
    const t = norm(texto);
    if (!t) return;
    const r = books.filter((b) => norm(b.titulo + " " + b.autor).includes(t));
    setResults(r); setSel(null);
    if (!r.length) toast("Nenhum livro encontrado", "error");
  }
  function copiar(c) { navigator.clipboard && navigator.clipboard.writeText(c); toast("Código copiado", "success"); }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Pesquisa de Livros</h1>
      <p className="mt-1 text-sm text-zinc-500">Busque pelo código de barras ou por título / autor.</p>

      <Card className="mt-5 p-5">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <Label>Código de Barras</Label>
            <div className="mt-1.5 flex gap-2">
              <Input value={codigo} icon={<Icons.barcode size={16}/>} placeholder="Código…" className="font-mono"
                onChange={(e) => setCodigo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscarCodigo()} />
              <Button variant="default" onClick={buscarCodigo}><Icons.search size={16}/> Pesquisar</Button>
            </div>
          </div>
          <div>
            <Label>Título ou Autor</Label>
            <div className="mt-1.5 flex gap-2">
              <Input value={texto} icon={<Icons.search size={16}/>} placeholder="Ex.: Bíblia, Lewis…"
                onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscarTexto()} />
              <Button variant="default" onClick={buscarTexto}><Icons.search size={16}/> Pesquisar</Button>
            </div>
          </div>
        </div>
      </Card>

      {sel ? (
        <Detalhes book={sel} onBack={() => setSel(null)} onCopy={copiar} backLabel={results && results.length > 1 ? "Voltar aos resultados" : null} />
      ) : results !== null ? (
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{results.length} resultado(s)</p>
          <div className="grid grid-cols-2 gap-3">
            {results.map((b) => (
              <button key={b.codigo} onClick={() => setSel(b)}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:bg-zinc-900">
                <Cover size="md" titulo={b.titulo} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{b.titulo}</div>
                  <div className="truncate text-xs text-zinc-500">{b.autor}</div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-50">{BRL(b.preco)}</span>
                    <StockBadge n={b.estoque} />
                  </div>
                </div>
                <Icons.chevR size={16} className="text-zinc-300 dark:text-zinc-600"/>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-12 flex flex-col items-center gap-2 text-zinc-400">
          <Icons.search size={28} className="opacity-50"/>
          <p className="text-sm">Faça uma busca para ver os resultados</p>
        </div>
      )}
    </div>
  );
}

function Detalhes({ book, onBack, onCopy, backLabel }) {
  return (
    <div className="mt-5">
      {backLabel && <Button variant="ghost" size="sm" onClick={onBack} className="mb-3"><Icons.chevR size={15} className="rotate-180"/> {backLabel}</Button>}
      <Card className="p-6">
        <h2 className="mb-5 text-center text-lg font-semibold text-zinc-900 dark:text-zinc-50">Detalhes</h2>
        <div className="grid grid-cols-[180px_1fr] gap-7">
          <Cover size="lg" titulo={book.titulo} />
          <div>
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{book.titulo}</h3>
            <p className="mt-0.5 text-sm text-zinc-500">{book.autor}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="font-mono text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{BRL(book.preco)}</span>
              <StockBadge n={book.estoque} />
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-zinc-400">Categoria</dt>
                <dd className="text-zinc-700 dark:text-zinc-200">{CATEGORIAS[book.categoria]}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-400">Estoque</dt>
                <dd className="font-mono text-zinc-700 dark:text-zinc-200">{book.estoque} un.</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-zinc-400">Código de Barras</dt>
                <dd className="flex items-center gap-2">
                  <span className="font-mono text-zinc-700 dark:text-zinc-200">{book.codigo}</span>
                  <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]" onClick={() => onCopy(book.codigo)}><Icons.copy size={12}/> Copiar</Button>
                </dd>
              </div>
              {book.descricao && (
                <div className="col-span-2">
                  <dt className="text-xs text-zinc-400">Descrição</dt>
                  <dd className="text-zinc-600 dark:text-zinc-300">{book.descricao}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { PesquisaScreen });

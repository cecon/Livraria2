// ── Relatórios — login gate + relatório emitido ───────────────────────────────
const REL_TIPOS = {
  dia:     { grupo: "venda", label: "Relatório dia Inteiro" },
  manha:   { grupo: "venda", label: "Turma da Manhã" },
  tarde:   { grupo: "venda", label: "Turma da Tarde" },
  zerado:  { grupo: "adm",   label: "Relatório Zerado" },
  estoque: { grupo: "adm",   label: "Relatório de Estoque" },
  usuario: { grupo: "user",  label: "Cadastro Usuário (Administrador)" },
};

function RelatorioScreen({ books }) {
  const toast = useToast();
  const [tipo, setTipo] = React.useState("dia");
  const [data, setData] = React.useState(new Date().toISOString().slice(0, 10));
  const [user, setUser] = React.useState("adm");
  const [pass, setPass] = React.useState("");
  const [emitido, setEmitido] = React.useState(null);

  function enviar() {
    if (!pass) { toast("Informe a senha", "error"); return; }
    if (tipo === "usuario") { toast("Acesso ao cadastro de usuários (somente Administrador)", "success"); return; }
    setEmitido({ tipo, data, user });
  }

  if (emitido) return <RelatorioEmitido {...emitido} books={books} onBack={() => setEmitido(null)} />;

  const Radio = ({ value, children }) => (
    <label className={cx("flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors",
      tipo === value ? "border-brand/50 bg-brand/5 text-zinc-900 dark:border-brand/50 dark:bg-brand/10 dark:text-zinc-50"
                     : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900")}>
      <span className={cx("flex h-4 w-4 items-center justify-center rounded-full border-2", tipo === value ? "border-brand" : "border-zinc-300 dark:border-zinc-600")}>
        {tipo === value && <span className="h-2 w-2 rounded-full bg-brand"></span>}
      </span>
      <input type="radio" name="tipo" className="sr-only" checked={tipo === value} onChange={() => setTipo(value)} />
      {children}
    </label>
  );

  return (
    <div className="mx-auto max-w-lg p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="rounded-lg bg-brand p-2 text-white"><Icons.lock size={18}/></span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Login para Relatórios</h1>
          <p className="text-sm text-zinc-500">Selecione o relatório e autentique-se.</p>
        </div>
      </div>

      <Card className="p-5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Relatórios de Venda</p>
        <div className="grid grid-cols-1 gap-2">
          <Radio value="dia">Relatório dia Inteiro</Radio>
          <div className="grid grid-cols-2 gap-2">
            <Radio value="manha">Turma da Manhã</Radio>
            <Radio value="tarde">Turma da Tarde</Radio>
          </div>
        </div>

        <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Relatórios Administrativos</p>
        <div className="grid grid-cols-2 gap-2">
          <Radio value="zerado">Relatório Zerado</Radio>
          <Radio value="estoque">Relatório de Estoque</Radio>
        </div>

        <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Inclusão de Usuários (Administrador)</p>
        <Radio value="usuario">Cadastro Usuário (Administrador)</Radio>

        <div className="mt-5 grid gap-3 border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <div>
            <Label>Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Usuário</Label>
              <Input value={user} onChange={(e) => setUser(e.target.value)} className="mt-1" icon={<Icons.user size={15}/>} />
            </div>
            <div>
              <Label>Senha</Label>
              <Input type="password" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === "Enter" && enviar()} className="mt-1" placeholder="••••••" icon={<Icons.lock size={15}/>} />
            </div>
          </div>
          <div className="flex items-center justify-end">
            <button onClick={() => toast("Fluxo de alteração de senha")} className="text-xs font-medium text-brand hover:underline">Alterar Senha</button>
          </div>
          <Button variant="brand" size="lg" onClick={enviar} className="w-full">Enviar</Button>
        </div>
      </Card>
    </div>
  );
}

// ── Relatório emitido ─────────────────────────────────────────────────────────
function RelatorioEmitido({ tipo, data, books, onBack }) {
  const dataFmt = new Date(data + "T00:00:00").toLocaleDateString("pt-BR");

  if (tipo === "estoque") return <RelEstoque books={books} dataFmt={dataFmt} onBack={onBack} />;
  if (tipo === "zerado")  return <RelZerado dataFmt={dataFmt} onBack={onBack} />;

  const pedidos = tipo === "dia" ? PEDIDOS_HOJE : PEDIDOS_HOJE.filter((p) => p.turno === tipo);
  const tot = pedidos.reduce((acc, p) => {
    PAGAMENTOS.forEach((pg) => acc[pg.key] = (acc[pg.key] || 0) + (p.pag[pg.key] || 0));
    return acc;
  }, {});
  const totalGeral = Object.values(tot).reduce((a, b) => a + b, 0);

  return (
    <RelShell title="Relatório de Vendas" sub={`Dia: ${dataFmt} · Turno: ${tipo === "dia" ? "Dia inteiro" : tipo === "manha" ? "Manhã" : "Tarde"} · Usuário: ADMINISTRADOR`} onBack={onBack}>
      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-100 text-left text-[11px] uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60">
              <th className="px-3 py-2 font-semibold">Código</th>
              <th className="px-3 py-2 font-semibold">Título</th>
              <th className="px-3 py-2 text-right font-semibold">Qtd × Vlr</th>
              {PAGAMENTOS.map((p) => <th key={p.key} className="px-3 py-2 text-right font-semibold">{p.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p) => (
              <React.Fragment key={p.numero}>
                {p.itens.map((it) => (
                  <tr key={p.numero + it.codigo} className="border-t border-zinc-100 dark:border-zinc-800/60">
                    <td className="px-3 py-1.5 font-mono text-xs text-zinc-500">{it.codigo}</td>
                    <td className="px-3 py-1.5 text-zinc-700 dark:text-zinc-200">{it.titulo}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-zinc-600 dark:text-zinc-300">{it.qtd} × {BRL(it.preco)}</td>
                    <td className="px-3 py-1.5" colSpan={5}></td>
                  </tr>
                ))}
                <tr className="border-t border-zinc-200 bg-brand/5 dark:border-zinc-700 dark:bg-brand/10">
                  <td className="px-3 py-1.5"></td>
                  <td className="px-3 py-1.5 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300">Forma de Pagamento — Pedido {p.numero}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-semibold text-zinc-800 dark:text-zinc-100">{BRL(Object.values(p.pag).reduce((a, b) => a + b, 0))}</td>
                  {PAGAMENTOS.map((pg) => <td key={pg.key} className="px-3 py-1.5 text-right font-mono text-xs text-zinc-600 dark:text-zinc-300">{BRL(p.pag[pg.key])}</td>)}
                </tr>
              </React.Fragment>
            ))}
            <tr className="border-t-2 border-zinc-300 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800/80">
              <td className="px-3 py-2"></td>
              <td className="px-3 py-2 text-right text-sm font-bold text-zinc-900 dark:text-zinc-50">Totais</td>
              <td className="px-3 py-2 text-right font-mono text-sm font-bold text-zinc-900 dark:text-zinc-50">{BRL(totalGeral)}</td>
              {PAGAMENTOS.map((pg) => <td key={pg.key} className="px-3 py-2 text-right font-mono text-xs font-bold text-zinc-800 dark:text-zinc-100">{BRL(tot[pg.key] || 0)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Resumo das vendas */}
      <div className="mt-5 grid grid-cols-[auto_1fr] items-center gap-5 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <div className="flex items-center gap-3 pr-5">
          <BrandMark size={42} />
          <div className="leading-tight">
            <div className="text-[15px] font-bold tracking-tight text-zinc-900 dark:text-zinc-50">RESUMO</div>
            <div className="text-xs text-zinc-500">DAS VENDAS</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          {[["Total Cartão", tot.cartao], ["Total PIX", tot.pix], ["Total Dinheiro", tot.dinheiro], ["Total Ministério", tot.ministerio], ["Total Vale Presente", tot.vale]].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between border-b border-zinc-100 py-1 dark:border-zinc-800/60">
              <span className="text-zinc-500">{k}</span><span className="font-mono font-medium text-zinc-800 dark:text-zinc-100">{BRL(v || 0)}</span>
            </div>
          ))}
          <div className="col-span-2 mt-1 flex items-center justify-between rounded-md bg-brand/10 px-2 py-1.5">
            <span className="font-semibold text-zinc-700 dark:text-zinc-200">Sub Total (Dinheiro + Cartão + PIX)</span>
            <span className="font-mono font-bold text-zinc-900 dark:text-zinc-50">{BRL((tot.cartao || 0) + (tot.pix || 0) + (tot.dinheiro || 0))}</span>
          </div>
        </div>
      </div>
    </RelShell>
  );
}

function RelEstoque({ books, dataFmt, onBack }) {
  const sorted = [...books].sort((a, b) => a.estoque - b.estoque);
  const valorTotal = books.reduce((s, b) => s + b.preco * b.estoque, 0);
  return (
    <RelShell title="Relatório de Estoque" sub={`Dia: ${dataFmt} · ${books.length} títulos · Valor em estoque: ${BRL(valorTotal)}`} onBack={onBack}>
      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-100 text-left text-[11px] uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60">
              <th className="px-3 py-2 font-semibold">Código</th><th className="px-3 py-2 font-semibold">Título</th>
              <th className="px-3 py-2 font-semibold">Categoria</th><th className="px-3 py-2 text-right font-semibold">Preço</th>
              <th className="px-3 py-2 text-center font-semibold">Estoque</th><th className="px-3 py-2 text-right font-semibold">Valor</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((b) => (
              <tr key={b.codigo} className="border-t border-zinc-100 dark:border-zinc-800/60">
                <td className="px-3 py-1.5 font-mono text-xs text-zinc-500">{b.codigo}</td>
                <td className="px-3 py-1.5 text-zinc-700 dark:text-zinc-200">{b.titulo}</td>
                <td className="px-3 py-1.5 text-xs text-zinc-500">{CATEGORIAS[b.categoria]}</td>
                <td className="px-3 py-1.5 text-right font-mono text-zinc-600 dark:text-zinc-300">{BRL(b.preco)}</td>
                <td className="px-3 py-1.5 text-center"><StockBadge n={b.estoque} /></td>
                <td className="px-3 py-1.5 text-right font-mono text-zinc-700 dark:text-zinc-200">{BRL(b.preco * b.estoque)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </RelShell>
  );
}

function RelZerado({ dataFmt, onBack }) {
  return (
    <RelShell title="Relatório Zerado" sub={`Dia: ${dataFmt} · Usuário: ADMINISTRADOR`} onBack={onBack}>
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-zinc-300 py-16 text-center dark:border-zinc-700">
        <span className="rounded-full bg-emerald-100 p-3 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"><Icons.check size={22}/></span>
        <div>
          <p className="font-semibold text-zinc-800 dark:text-zinc-100">Caixa zerado com sucesso</p>
          <p className="mt-1 text-sm text-zinc-500">Os totais do período foram reiniciados para o próximo turno.</p>
        </div>
      </div>
    </RelShell>
  );
}

function RelShell({ title, sub, onBack, children }) {
  const toast = useToast();
  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><Icons.chevR size={18} className="rotate-180"/></Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h1>
          <p className="text-xs text-zinc-500">{sub}</p>
        </div>
        <Button variant="outline" onClick={() => toast("Enviado para impressão")}><Icons.printer size={16}/> Imprimir</Button>
      </div>
      <Card className="p-5">{children}</Card>
    </div>
  );
}

Object.assign(window, { RelatorioScreen });

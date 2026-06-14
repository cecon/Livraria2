// ── App shell: sidebar nav + routing + theme ──────────────────────────────────
const NAV = [
  { id: "home",      label: "Início",         icon: Icons.home },
  { id: "venda",     label: "Venda",          icon: Icons.cart },
  { id: "cadastro",  label: "Cadastro",       icon: Icons.bookPlus },
  { id: "relatorio", label: "Relatório",      icon: Icons.report },
  { id: "pesquisa",  label: "Pesquisa",       icon: Icons.search },
];

function ThemeToggle({ dark, setDark }) {
  return (
    <button onClick={() => setDark(!dark)}
      className="flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-[13px] text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200">
      {dark ? <Icons.sun size={16}/> : <Icons.moon size={16}/>}
      {dark ? "Tema claro" : "Tema escuro"}
    </button>
  );
}

function Sidebar({ route, go, dark, setDark }) {
  const toast = useToast();
  const [sync, setSync] = React.useState(false);
  function atualizar() {
    setSync(true);
    setTimeout(() => { setSync(false); toast("Dados atualizados", "success"); }, 900);
  }
  return (
    <aside className="flex w-64 shrink-0 flex-col bg-zinc-900 dark:bg-zinc-950 dark:border-r dark:border-zinc-800">
      {/* brand */}
      <div className="flex items-center gap-2.5 px-4 py-5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/95 shadow-sm"><BrandMark size={28} /></span>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[13px] font-semibold tracking-tight text-white">Espaço do&nbsp;Livro</div>
          <div className="truncate text-[11px] text-zinc-400">PIB Penha</div>
        </div>
      </div>

      {/* nav */}
      <nav className="flex flex-1 flex-col gap-1 px-3 pt-2">
        {NAV.map((n) => {
          const active = route === n.id;
          return (
            <button key={n.id} onClick={() => go(n.id)}
              className={cx("group flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                active ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200")}>
              <span className={cx(active ? "text-brand-300" : "text-zinc-500 group-hover:text-zinc-300")}><n.icon size={18} /></span>
              {n.label}
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-400"></span>}
            </button>
          );
        })}

        <button onClick={atualizar}
          className="mt-1 flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200">
          <span className={cx("text-zinc-500", sync && "animate-spin")}><Icons.refresh size={18} /></span>
          {sync ? "Atualizando…" : "Atualizar Dados"}
        </button>
      </nav>

      {/* footer */}
      <div className="border-t border-white/10 p-3">
        <ThemeToggle dark={dark} setDark={setDark} />
        <div className="mt-2 flex items-center gap-2.5 rounded-lg px-2.5 py-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-brand/20 text-brand-300"><Icons.user size={16}/></span>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[13px] font-medium text-zinc-200">Administrador</div>
            <div className="truncate text-[11px] text-zinc-500">adm · caixa 01</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function App() {
  const [route, setRoute] = React.useState(() => localStorage.getItem("eldl-route") || "home");
  const [dark, setDark] = React.useState(() => {
    const s = localStorage.getItem("eldl-theme");
    return s ? s === "dark" : false;
  });
  const [books, setBooks] = React.useState(BOOKS);

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("eldl-theme", dark ? "dark" : "light");
  }, [dark]);
  const go = (r) => { setRoute(r); localStorage.setItem("eldl-route", r); };

  return (
    <ToastHost>
      <div className="flex h-screen w-screen overflow-hidden bg-zinc-50 text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
        <Sidebar route={route} go={go} dark={dark} setDark={setDark} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          {route === "home"      && <HomeScreen books={books} go={go} />}
          {route === "venda"     && <VendaScreen books={books} />}
          {route === "cadastro"  && <CadastroScreen books={books} setBooks={setBooks} />}
          {route === "pesquisa"  && <PesquisaScreen books={books} />}
          {route === "relatorio" && <RelatorioScreen books={books} />}
        </main>
      </div>
    </ToastHost>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

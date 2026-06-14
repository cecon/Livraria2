// ── shadcn-style primitives (zinc neutrals + brand green) ─────────────────────
const cx = (...a) => a.filter(Boolean).join(" ");

// Button -----------------------------------------------------------------------
function Button({ variant = "default", size = "md", className = "", children, ...rest }) {
  const base = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 disabled:opacity-50 disabled:pointer-events-none select-none";
  const sizes = {
    sm: "h-8 px-3 text-[13px]",
    md: "h-9 px-4 text-sm",
    lg: "h-11 px-6 text-[15px]",
    icon: "h-9 w-9",
  };
  const variants = {
    default: "bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white shadow-sm",
    brand:   "bg-brand text-white hover:bg-brand-600 shadow-sm",
    outline: "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900",
    ghost:   "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900",
    destructive: "bg-rose-600 text-white hover:bg-rose-700 shadow-sm",
    softDestructive: "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/70",
    secondary: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",
  };
  return (
    <button className={cx(base, sizes[size], variants[variant], className)} {...rest}>
      {children}
    </button>
  );
}

// Input ------------------------------------------------------------------------
const Input = React.forwardRef(function Input({ className = "", icon, ...rest }, ref) {
  const field = (
    <input
      ref={ref}
      className={cx(
        "h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-zinc-400",
        "dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-600",
        icon && "pl-9", className
      )}
      {...rest}
    />
  );
  if (!icon) return field;
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">{icon}</span>
      {field}
    </div>
  );
});

// Textarea ---------------------------------------------------------------------
function Textarea({ className = "", ...rest }) {
  return (
    <textarea
      className={cx(
        "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm transition-colors resize-none",
        "focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-zinc-400",
        "dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-600",
        className
      )}
      {...rest}
    />
  );
}

// Label ------------------------------------------------------------------------
const Label = ({ className = "", children, ...rest }) => (
  <label className={cx("text-[13px] font-medium text-zinc-600 dark:text-zinc-400", className)} {...rest}>{children}</label>
);

// Card -------------------------------------------------------------------------
const Card = ({ className = "", children, ...rest }) => (
  <div className={cx("rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60", className)} {...rest}>{children}</div>
);

// Badge ------------------------------------------------------------------------
function Badge({ tone = "neutral", className = "", children }) {
  const tones = {
    neutral: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    brand:   "bg-brand/10 text-brand-700 dark:bg-brand/20 dark:text-brand-300",
    amber:   "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
    rose:    "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
    green:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  };
  return <span className={cx("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold", tones[tone], className)}>{children}</span>;
}

// Stock pill (shared) ----------------------------------------------------------
function StockBadge({ n }) {
  if (n <= 0) return <Badge tone="rose">Esgotado</Badge>;
  if (n <= 3) return <Badge tone="amber">Estoque {n}</Badge>;
  return <Badge tone="green">Estoque {n}</Badge>;
}

// Book cover placeholder (legacy "Imagem não cadastrada") -----------------------
function Cover({ size = "md", titulo = "" }) {
  const dims = { sm: "h-9 w-7 text-[8px]", md: "h-14 w-11 text-[9px]", lg: "h-44 w-32 text-xs" }[size];
  const initials = titulo.replace(/[^A-Za-zÀ-ÿ ]/g, "").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  return (
    <div className={cx("relative shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-gradient-to-br from-zinc-100 to-zinc-200 dark:border-zinc-700 dark:from-zinc-800 dark:to-zinc-900 flex items-center justify-center", dims)}>
      <span className="absolute left-0 top-0 h-full w-[3px] bg-brand/60"></span>
      <span className="font-semibold text-zinc-400 dark:text-zinc-500">{initials || "·"}</span>
    </div>
  );
}

// Modal ------------------------------------------------------------------------
function Modal({ open, onClose, children, className = "" }) {
  React.useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-[2px] animate-[fade_.12s_ease-out]"></div>
      <div onMouseDown={(e) => e.stopPropagation()}
        className={cx("relative w-full max-w-xl rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 animate-[pop_.14s_ease-out]", className)}>
        {children}
      </div>
    </div>
  );
}

// Toast ------------------------------------------------------------------------
const ToastCtx = React.createContext(() => {});
function ToastHost({ children }) {
  const [toasts, setToasts] = React.useState([]);
  const push = React.useCallback((msg, tone = "default") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={cx(
            "flex items-center gap-2.5 rounded-lg border px-4 py-2.5 text-sm shadow-lg animate-[slideup_.16s_ease-out]",
            t.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
            : t.tone === "error" ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200"
            : "border-zinc-200 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          )}>
            {t.tone === "success" && <Icons.check size={16} className="text-emerald-600 dark:text-emerald-400"/>}
            {t.tone === "error" && <Icons.alert size={16} className="text-rose-600 dark:text-rose-400"/>}
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
const useToast = () => React.useContext(ToastCtx);

Object.assign(window, { cx, Button, Input, Textarea, Label, Card, Badge, StockBadge, Cover, Modal, ToastHost, useToast });

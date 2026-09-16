// Seletor do operador atual do caixa (feature 007, FR-023). Fica na sidebar; o
// valor é carimbado em cada venda. Sem senha — é atribuição, não autenticação.
import { useEffect, useState } from "react";
import { listarOperadores, type OperadorDto } from "@/lib/ipc";
import { operadorAtual, setOperadorAtual } from "@/lib/operador";

export function OperadorAtual() {
  const [operadores, setOperadores] = useState<OperadorDto[]>([]);
  const [atual, setAtual] = useState("");

  useEffect(() => {
    setAtual(operadorAtual());
    // Recarrega periodicamente: após o sync, um operador desativado some da lista
    // (listar_operadores filtra excluido_em). Se o operador ATUAL foi desativado,
    // limpa a seleção — "logout forçado" da atribuição (feature 010, FR-018).
    const carregar = () =>
      listarOperadores()
        .then((ops) => {
          setOperadores(ops);
          const at = operadorAtual();
          if (at && !ops.some((o) => o.usuario === at)) {
            setOperadorAtual("");
            setAtual("");
          }
        })
        .catch(() => setOperadores([]));
    carregar();
    const id = setInterval(carregar, 30000);
    return () => clearInterval(id);
  }, []);

  // Só aparece se houver operadores cadastrados além do admin.
  const opcoes = operadores.filter((o) => o.usuario !== "adm");
  if (opcoes.length === 0) return null;

  function trocar(usuario: string) {
    setAtual(usuario);
    setOperadorAtual(usuario);
  }

  return (
    <label className="block text-xs text-neutral-500 dark:text-slate-400">
      Operador
      <select
        value={atual}
        onChange={(e) => trocar(e.target.value)}
        className="mt-1 h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-700 dark:border-slate-600 dark:bg-[#273142] dark:text-slate-100"
      >
        <option value="">— não informado —</option>
        {opcoes.map((o) => (
          <option key={o.usuario} value={o.usuario}>
            {o.nome || o.usuario}
          </option>
        ))}
      </select>
    </label>
  );
}

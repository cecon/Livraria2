// Venda — wrapper com 2 abas: "Venda" (PDV) e "Lista de vendas" (editar o dia).

import { useState } from "react";
import { Pdv } from "@/components/Pdv";
import { ListaVendas } from "@/routes/ListaVendas";

type Aba = "pdv" | "lista";

export default function Venda() {
  const [aba, setAba] = useState<Aba>("pdv");

  return (
    <div className="flex h-screen flex-col">
      <div className="flex gap-1 border-b px-5 pt-3">
        <TabBtn ativo={aba === "pdv"} onClick={() => setAba("pdv")}>
          Venda
        </TabBtn>
        <TabBtn ativo={aba === "lista"} onClick={() => setAba("lista")}>
          Lista de vendas
        </TabBtn>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {aba === "pdv" ? <Pdv /> : <ListaVendas onClonar={() => setAba("pdv")} />}
      </div>
    </div>
  );
}

function TabBtn({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        ativo
          ? "border-[#1f7a4d] text-foreground"
          : "text-muted-foreground hover:text-foreground border-transparent"
      }`}
    >
      {children}
    </button>
  );
}

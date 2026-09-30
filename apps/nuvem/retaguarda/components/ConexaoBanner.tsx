"use client";

import { useEffect, useState } from "react";
import { Alert, Snackbar } from "@mui/material";

// Estado de conexão (US2/T033, FR-010). O Escritório é online: sem rede, avisa.
// (As gravações também tratam erro da nuvem na camada de dados.)
export function ConexaoBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online) return null;
  return (
    <Snackbar open anchorOrigin={{vertical:'top',horizontal:'center'}}>
      <Alert severity="error" variant="filled">Sem conexão. A retaguarda precisa estar online para gravar na nuvem.</Alert>
    </Snackbar>
  );
}

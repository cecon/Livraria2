"use client";
import { Autocomplete, TextField } from "@mui/material";
import type { Fornecedor } from "@/lib/nuvem/fornecedor";
export function FornecedorSelect({
  fornecedores,
  selecionadoNome,
  onSelect,
}: {
  fornecedores: Fornecedor[];
  selecionadoNome?: string | null;
  onSelect: (f: Fornecedor) => void;
}) {
  return (
    <Autocomplete
      options={fornecedores}
      value={fornecedores.find((f) => f.nome === selecionadoNome) ?? null}
      getOptionLabel={(f) => f.nome}
      isOptionEqualToValue={(a, b) => a.sync_uid === b.sync_uid}
      onChange={(_, value) => {
        if (value) onSelect(value);
      }}
      clearIcon={null}
      size="small"
      noOptionsText="Nenhum fornecedor encontrado"
      openText="Exibir fornecedores"
      closeText="Fechar"
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder="Escolha o fornecedor…"
          inputProps={{ ...params.inputProps, "aria-label": "Fornecedor" }}
        />
      )}
    />
  );
}

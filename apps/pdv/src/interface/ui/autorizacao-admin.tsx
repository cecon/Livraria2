"use client";
import { Input } from "./input";
import { Label } from "./label";

export type CredencialAdmin = { usuario: string; senha: string };
export function AutorizacaoAdmin({
  value,
  onChange,
  disabled,
  id = "admin",
}: {
  value: CredencialAdmin;
  onChange: (value: CredencialAdmin) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <fieldset disabled={disabled} className="space-y-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">
        Autorização da retaguarda
      </legend>
      <p className="text-muted-foreground text-xs">
        Informe um administrador para autorizar esta operação.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${id}-usuario`}>Usuário</Label>
          <Input
            id={`${id}-usuario`}
            autoComplete="off"
            value={value.usuario}
            onChange={(e) => onChange({ ...value, usuario: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor={`${id}-senha`}>Senha</Label>
          <Input
            id={`${id}-senha`}
            type="password"
            autoComplete="off"
            value={value.senha}
            onChange={(e) => onChange({ ...value, senha: e.target.value })}
            required
          />
        </div>
      </div>
    </fieldset>
  );
}

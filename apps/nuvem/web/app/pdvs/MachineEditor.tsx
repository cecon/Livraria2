"use client";

import { FormEvent, useState } from "react";
import { Button } from "@livraria/ui/ui/button";
import { Input } from "@livraria/ui/ui/input";
import { Label } from "@livraria/ui/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@livraria/ui/ui/select";
import { ContentPanel } from "@/components/ContentPanel";
import type { Machine, MachineInput, MachineUser } from "./types";

export function MachineEditor({ machine, users, saving, error, onSave, onCancel }: {
  machine: Machine | null;
  users: MachineUser[];
  saving: boolean;
  error: string;
  onSave: (input: MachineInput) => Promise<void>;
  onCancel: () => void;
}) {
  const available = users.filter(user => user.ativo && !user.excluido_em);
  const [nome, setNome] = useState(machine?.nome ?? "");
  const [usuarioUid, setUsuarioUid] = useState(machine?.usuarioUid ?? available[0]?.sync_uid ?? "");

  function submit(event: FormEvent) {
    event.preventDefault();
    void onSave({ nome: nome.trim(), usuarioUid });
  }

  return <ContentPanel
    title={machine ? "Dados da máquina" : "Cadastrar máquina"}
    description="Defina como esta instalação será identificada e qual operador será usado nas vendas."
  >
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="machine-name">Nome da máquina</Label>
          <Input id="machine-name" className="mt-1 h-10" maxLength={100} required autoFocus
            value={nome} onChange={event => setNome(event.target.value)} placeholder="Ex.: Balcão principal" />
        </div>
        <div>
          <Label htmlFor="machine-user">Operador vinculado</Label>
          <Select value={usuarioUid} onValueChange={setUsuarioUid} required>
            <SelectTrigger id="machine-user" className="mt-1 h-10 w-full">
              <SelectValue placeholder="Selecione um operador" />
            </SelectTrigger>
            <SelectContent>
              {available.map(user => <SelectItem key={user.sync_uid} value={user.sync_uid}>
                {user.nome || user.usuario} ({user.usuario})
              </SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      {machine && machine.usuarioUid !== usuarioUid ? <p className="text-xs text-amber-700 dark:text-amber-300">
        Ao trocar o operador, a credencial atual será cancelada e uma nova deverá ser configurada no PDV.
      </p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="h-10" disabled={saving || !nome.trim() || !usuarioUid}>
          {saving ? "Salvando..." : machine ? "Salvar alterações" : "Cadastrar máquina"}
        </Button>
        <Button type="button" variant="outline" className="h-10" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  </ContentPanel>;
}

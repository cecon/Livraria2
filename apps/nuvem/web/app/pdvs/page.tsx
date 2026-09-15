"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@livraria/ui/ui/button";
import { browserApiRequest } from "@/lib/api/browser-client";
import { ContentPanel } from "@/components/ContentPanel";
import { PageHeader } from "@/components/PageHeader";
import { MachineCredentials } from "./MachineCredentials";
import { MachineEditor } from "./MachineEditor";
import { MachineList } from "./MachineList";
import type { Machine, MachineCredential, MachineInput, MachineUser } from "./types";

type View = { kind: "list" } | { kind: "new" } | { kind: "edit"; machine: Machine };

export default function MachinesPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [users, setUsers] = useState<MachineUser[]>([]);
  const [view, setView] = useState<View>({ kind: "list" });
  const [credential, setCredential] = useState<MachineCredential | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [machineData, userData] = await Promise.all([
        browserApiRequest<Machine[]>("/api/pdvs", { fallback: "Não foi possível carregar as máquinas." }),
        browserApiRequest<MachineUser[]>("/api/usuarios", { fallback: "Não foi possível carregar os operadores." }),
      ]);
      setMachines(machineData); setUsers(userData);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao carregar."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save(input: MachineInput) {
    setSaving(true); setError("");
    try {
      const editing = view.kind === "edit" ? view.machine : null;
      const result = await browserApiRequest<MachineCredential & { atualizado?: boolean }>(
        editing ? `/api/pdvs/${editing.uid}` : "/api/pdvs",
        { method: editing ? "PUT" : "POST", body: input, fallback: "Não foi possível salvar a máquina." },
      );
      setView({ kind: "list" });
      if (result.refreshToken) setCredential({ uid: result.uid, refreshToken: result.refreshToken });
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao salvar."); }
    finally { setSaving(false); }
  }

  async function rotate(machine: Machine) {
    if (!confirm(`Gerar uma nova credencial para "${machine.nome}"? A credencial atual deixará de funcionar.`)) return;
    setBusyUid(machine.uid); setError("");
    try {
      const result = await browserApiRequest<{ refreshToken: string }>(`/api/pdvs/${machine.uid}/token`,
        { method: "POST", body: {}, fallback: "Não foi possível renovar a credencial." });
      setCredential({ uid: machine.uid, refreshToken: result.refreshToken });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao renovar."); }
    finally { setBusyUid(null); }
  }

  async function disable(machine: Machine) {
    if (!confirm(`Desativar "${machine.nome}"? Ela deixará de sincronizar imediatamente.`)) return;
    setBusyUid(machine.uid); setError("");
    try {
      await browserApiRequest(`/api/pdvs/${machine.uid}/desativar`,
        { method: "POST", body: {}, fallback: "Não foi possível desativar a máquina." });
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao desativar."); }
    finally { setBusyUid(null); }
  }

  const editing = view.kind === "edit" ? view.machine : null;
  const formOpen = view.kind !== "list";
  return <main className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:p-6 lg:py-7">
    <PageHeader
      title={view.kind === "new" ? "Nova máquina" : editing ? "Editar máquina" : "Máquinas"}
      description="Cadastre os computadores de venda e acompanhe a sincronização do catálogo."
      crumbs={formOpen ? [{ label: "Administração" }, { label: "Máquinas", onClick: () => setView({ kind: "list" }) },
        { label: editing ? "Editar" : "Nova" }] : [{ label: "Administração" }, { label: "Máquinas" }]}
      back={formOpen ? { label: "Voltar para máquinas", onClick: () => setView({ kind: "list" }) } : undefined}
      action={!formOpen ? <div className="flex gap-2">
        <Button variant="outline" size="icon" onClick={() => void load()} title="Atualizar lista">
          <RefreshCw className={loading ? "animate-spin" : ""} />
        </Button>
        <Button className="h-10" onClick={() => { setError(""); setView({ kind: "new" }); }}><Plus /> Nova máquina</Button>
      </div> : undefined}
    />

    {credential ? <MachineCredentials credential={credential} onClose={() => setCredential(null)} /> : null}
    {formOpen ? <MachineEditor key={editing?.uid ?? "new"} machine={editing} users={users}
      saving={saving} error={error} onSave={save} onCancel={() => setView({ kind: "list" })} /> : <>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <ContentPanel title="Máquinas cadastradas"
        description={`${machines.length} máquina(s), incluindo instalações desativadas.`} flush>
        <MachineList machines={machines} busyUid={busyUid}
          onEdit={machine => { setError(""); setView({ kind: "edit", machine }); }}
          onRotate={machine => void rotate(machine)} onDisable={machine => void disable(machine)} />
      </ContentPanel>
    </>}
  </main>;
}

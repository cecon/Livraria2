"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { Button } from "@livraria/ui/ui/button";
import { ContentPanel } from "@/components/ContentPanel";
import type { MachineCredential } from "./types";

export function MachineCredentials({ credential, onClose }: {
  credential: MachineCredential;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<"uid" | "token" | null>(null);
  async function copy(kind: "uid" | "token", value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1500);
  }
  return <ContentPanel title="Credencial da máquina"
    description="Configure estes dados no PDV agora. O token não será mostrado novamente.">
    <div className="space-y-4">
      <CredentialRow label="Identificador da máquina" value={credential.uid}
        copied={copied === "uid"} onCopy={() => void copy("uid", credential.uid)} />
      <CredentialRow label="Token de atualização" value={credential.refreshToken}
        copied={copied === "token"} onCopy={() => void copy("token", credential.refreshToken)} />
      <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
        <KeyRound className="mt-0.5 size-4 shrink-0" />
        Feche somente depois de configurar ou guardar o token em local seguro.
      </div>
      <Button type="button" onClick={onClose}>Concluir</Button>
    </div>
  </ContentPanel>;
}

function CredentialRow({ label, value, copied, onCopy }: {
  label: string; value: string; copied: boolean; onCopy: () => void;
}) {
  return <div>
    <div className="mb-1 text-sm font-medium">{label}</div>
    <div className="flex min-w-0 gap-2">
      <code className="min-w-0 flex-1 overflow-x-auto rounded-md border bg-muted px-3 py-2 text-xs">{value}</code>
      <Button type="button" size="icon" variant="outline" onClick={onCopy}
        title={copied ? "Copiado" : `Copiar ${label.toLowerCase()}`}>
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  </div>;
}

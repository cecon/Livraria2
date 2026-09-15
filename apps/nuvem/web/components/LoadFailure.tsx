"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@livraria/ui/ui/button";

export function LoadFailure({ title, message, onRetry }: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <section role="alert" className="admin-panel flex flex-col items-center gap-3 border bg-card p-6 text-center">
      <AlertCircle className="text-destructive" size={36} />
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
      <Button onClick={onRetry} className="h-9">
        <RefreshCw className="size-4" />
        Tentar novamente
      </Button>
    </section>
  );
}

"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@livraria/ui/ui/button";

const RETRY_AFTER_SECONDS = 5;

export function LoadFailure({ title, message, onRetry }: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  const [seconds, setSeconds] = useState(RETRY_AFTER_SECONDS);

  useEffect(() => {
    const interval = window.setInterval(() => setSeconds((current) => Math.max(0, current - 1)), 1000);
    const retry = window.setTimeout(onRetry, RETRY_AFTER_SECONDS * 1000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(retry);
    };
  }, [onRetry]);

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
      <p aria-live="polite" className="text-xs text-muted-foreground">
        Nova tentativa automática em {seconds}s
      </p>
    </section>
  );
}

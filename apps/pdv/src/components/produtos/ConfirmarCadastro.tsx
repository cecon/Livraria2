import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@livraria/ui/ui/dialog";
export function ConfirmarCadastro({
  codigo,
  onConfirmar,
  onCancelar,
}: {
  codigo: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const cancelar = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancelar();
      }}
    >
      <DialogContent
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          cancelar.current?.focus();
        }}
      >
        <DialogTitle className="text-lg font-semibold">
          Produto não encontrado
        </DialogTitle>
        <DialogDescription className="text-muted-foreground text-sm">
          Código <span className="font-mono">{codigo}</span>. Deseja
          cadastrá-lo?
        </DialogDescription>
        <div className="flex flex-wrap justify-end gap-2">
          <Button ref={cancelar} variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button onClick={onConfirmar}>Sim, cadastrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

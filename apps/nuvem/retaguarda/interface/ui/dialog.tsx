"use client";
import React, { createContext, useContext, useId } from "react";
import {
  Dialog as MuiDialog,
  DialogContent as MuiContent,
  DialogTitle as MuiTitle,
  DialogContentText,
  DialogActions,
  IconButton,
} from "@mui/material";
import { X } from "lucide-react";
const DialogContext = createContext({ close: () => {}, title: "" });
export function Dialog({
  open = false,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  children: React.ReactNode;
}) {
  const title = useId();
  const close = () => onOpenChange?.(false);
  return (
    <DialogContext.Provider value={{ close, title }}>
      <MuiDialog open={open} onClose={close} aria-labelledby={title}>
        {children}
      </MuiDialog>
    </DialogContext.Provider>
  );
}
export function DialogContent({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { close } = useContext(DialogContext);
  return (
    <MuiContent
      className={className}
      {...props}
      sx={{ p: 3, pt: 3.5, position: "relative" }}
    >
      <IconButton
        aria-label="Fechar diálogo"
        onClick={close}
        size="small"
        sx={{ position: "absolute", right: 10, top: 10 }}
      >
        <X size={18} />
      </IconButton>
      {children}
    </MuiContent>
  );
}
export function DialogTitle(props: React.ComponentProps<"h2">) {
  const { title } = useContext(DialogContext);
  return <MuiTitle id={title} {...props} sx={{ p: 0, pr: 4, mb: 1 }} />;
}
export function DialogDescription(props: React.ComponentProps<"p">) {
  return <DialogContentText {...props} sx={{ mb: 2 }} />;
}
export function DialogHeader(props: React.ComponentProps<"div">) {
  return <div {...props} />;
}
export function DialogFooter(props: React.ComponentProps<"div">) {
  return <DialogActions {...props} />;
}

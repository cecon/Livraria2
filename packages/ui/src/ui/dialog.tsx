"use client";
import type { ComponentProps } from "react";
import { Dialog as Primitive } from "radix-ui";
import { cn } from "../utils";

export const Dialog = Primitive.Root;
export const DialogTitle = Primitive.Title;
export const DialogDescription = Primitive.Description;
export const DialogClose = Primitive.Close;

export function DialogContent({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px]" />
      <Primitive.Content
        {...props}
        className={cn(
          "bg-background fixed left-1/2 top-1/2 z-50 grid max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-lg border p-6 shadow-lg outline-none",
          className,
        )}
      >
        {children}
      </Primitive.Content>
    </Primitive.Portal>
  );
}

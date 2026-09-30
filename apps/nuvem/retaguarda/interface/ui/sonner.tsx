"use client";
import { Toaster as Notifications } from "sonner";
import { useTheme } from "next-themes";
export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Notifications
      richColors
      closeButton
      theme={resolvedTheme === "dark" ? "dark" : "light"}
    />
  );
}

"use client";
import FormLabel from "@mui/material/FormLabel";
import type { ComponentProps } from "react";
export function Label(props: Omit<ComponentProps<"label">, "color">) {
  return (
    <FormLabel
      id={props.htmlFor ? `${props.htmlFor}-label` : undefined}
      {...props}
      sx={{ color: "text.primary", fontSize: 14, fontWeight: 500 }}
    />
  );
}

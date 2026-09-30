"use client";
import React from "react";
import Link from "next/link";
import MuiButton from "@mui/material/Button";
type Props = Omit<React.ComponentProps<"button">, "color"> & {
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link"
    | null;
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm" | null;
  asChild?: boolean;
};
export const Button = React.forwardRef<HTMLButtonElement, Props>(
  function Button(
    { variant, size, asChild, children, className, ...props },
    ref,
  ) {
    const v =
      variant === "outline"
        ? "outlined"
        : variant === "ghost" || variant === "link"
          ? "text"
          : "contained";
    const color =
      variant === "destructive"
        ? "error"
        : variant === "secondary" || variant === "outline"
          ? "secondary"
          : "primary";
    const common = {
      variant: v as "outlined" | "text" | "contained",
      color: color as "error" | "secondary" | "primary",
      size:
        size === "sm" || size === "icon-sm"
          ? ("small" as const)
          : size === "lg"
            ? ("large" as const)
            : ("medium" as const),
      className,
      sx: size?.startsWith("icon")
        ? { minWidth: 38, width: 38, p: 1 }
        : undefined,
    };
    if (
      asChild &&
      React.isValidElement<{ href: string; children: React.ReactNode }>(
        children,
      )
    ) {
      return (
        <MuiButton {...common} component={Link} href={children.props.href}>
          {children.props.children}
        </MuiButton>
      );
    }
    return (
      <MuiButton ref={ref} type="submit" {...common} {...props}>
        {children}
      </MuiButton>
    );
  },
);

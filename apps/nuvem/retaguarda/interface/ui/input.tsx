"use client";
import React from "react";
import OutlinedInput from "@mui/material/OutlinedInput";
import InputAdornment from "@mui/material/InputAdornment";
export const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input"> & { startIcon?: React.ReactNode }
>(function Input({ className, size: _size, startIcon, ...props }, ref) {
  const {
    onChange,
    disabled,
    value,
    defaultValue,
    type,
    id,
    name,
    required,
    autoFocus,
    ...native
  } = props;
  return (
    <OutlinedInput
      fullWidth
      size="small"
      className={className}
      inputRef={ref}
      id={id}
      name={name}
      type={type}
      disabled={disabled}
      value={value}
      defaultValue={defaultValue}
      required={required}
      autoFocus={autoFocus}
      startAdornment={
        startIcon ? (
          <InputAdornment position="start">{startIcon}</InputAdornment>
        ) : undefined
      }
      inputProps={native}
      onChange={onChange}
    />
  );
});

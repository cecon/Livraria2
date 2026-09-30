"use client";
import React from "react";
import OutlinedInput from "@mui/material/OutlinedInput";
export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(function Textarea(
  {
    className,
    rows = 3,
    onChange,
    value,
    defaultValue,
    disabled,
    id,
    name,
    ...props
  },
  ref,
) {
  return (
    <OutlinedInput
      multiline
      fullWidth
      className={className}
      rows={rows}
      inputRef={ref}
      id={id}
      name={name}
      value={value}
      defaultValue={defaultValue}
      disabled={disabled}
      inputProps={props}
      onChange={onChange}
    />
  );
});

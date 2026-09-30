"use client";
import React, { useState } from "react";
import { Select as MuiSelect, MenuItem } from "@mui/material";
type ChildProps = {
  children?: React.ReactNode;
  className?: string;
  id?: string;
  placeholder?: string;
  value?: string;
  disabled?: boolean;
  "aria-label"?: string;
};
export function SelectTrigger(_props: ChildProps) {
  return null;
}
export function SelectContent(_props: ChildProps) {
  return null;
}
export function SelectItem(_props: ChildProps) {
  return null;
}
export function SelectValue(_props: ChildProps) {
  return null;
}
export function Select({
  children,
  value,
  defaultValue = "",
  onValueChange,
  disabled,
  required,
  name,
}: {
  children: React.ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  disabled?: boolean;
  required?: boolean;
  name?: string;
}) {
  const [local, setLocal] = useState(defaultValue);
  const elements = React.Children.toArray(children).filter(
    React.isValidElement,
  ) as React.ReactElement<ChildProps>[];
  const trigger = elements.find((c) => c.type === SelectTrigger)?.props;
  const items: React.ReactElement<ChildProps>[] = [];
  function collect(nodes: React.ReactNode) {
    React.Children.forEach(nodes, (node) => {
      if (React.isValidElement<ChildProps>(node)) {
        if (node.type === SelectItem) items.push(node);
        else collect(node.props.children);
      }
    });
  }
  collect(children);
  const selected = value ?? local;
  const placeholder = React.Children.toArray(trigger?.children).find(
    React.isValidElement,
  ) as React.ReactElement<ChildProps> | undefined;
  return (
    <MuiSelect
      fullWidth
      size="small"
      displayEmpty
      value={selected}
      disabled={disabled}
      required={required}
      name={name}
      labelId={trigger?.id ? `${trigger.id}-label` : undefined}
      id={trigger?.id}
      className={trigger?.className}
      inputProps={{ "aria-label": trigger?.["aria-label"] }}
      onChange={(e) => {
        setLocal(e.target.value);
        onValueChange?.(e.target.value);
      }}
      renderValue={(v) =>
        items.find((i) => i.props.value === v)?.props.children ??
        placeholder?.props.placeholder ??
        "Selecione"
      }
    >
      {items.map((item) => (
        <MenuItem
          key={item.props.value}
          value={item.props.value}
          disabled={item.props.disabled}
        >
          {item.props.children}
        </MenuItem>
      ))}
    </MuiSelect>
  );
}

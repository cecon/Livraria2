"use client";
import React from "react";
import {
  Table as MuiTable,
  TableContainer,
  TableHead as MuiHead,
  TableBody as MuiBody,
  TableFooter as MuiFooter,
  TableRow as MuiRow,
  TableCell as MuiCell,
} from "@mui/material";
export function Table(props: React.ComponentProps<"table">) {
  return (
    <TableContainer>
      <MuiTable {...props} />
    </TableContainer>
  );
}
export function TableHeader(props: React.ComponentProps<"thead">) {
  return <MuiHead {...props} />;
}
export function TableBody(props: React.ComponentProps<"tbody">) {
  return <MuiBody {...props} />;
}
export function TableFooter(props: React.ComponentProps<"tfoot">) {
  return <MuiFooter {...props} />;
}
export function TableRow(props: React.ComponentProps<"tr">) {
  return <MuiRow hover {...props} />;
}
export function TableHead(props: Omit<React.ComponentProps<"th">, "align">) {
  return <MuiCell component="th" {...props} />;
}
export function TableCell(props: Omit<React.ComponentProps<"td">, "align">) {
  return <MuiCell {...props} />;
}
export function TableCaption(props: React.ComponentProps<"caption">) {
  return <caption {...props} />;
}

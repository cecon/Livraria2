"use client";
import { Card, CardHeader, CardContent, Box, Divider } from "@mui/material";
import type { ReactNode } from "react";
// MainCard structure from the supplied Able Pro seed; domain content remains in the pages.
export function ContentPanel({
  title,
  description,
  toolbar,
  children,
  footer,
  flush = false,
  className,
}: {
  title?: string;
  description?: string;
  toolbar?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  flush?: boolean;
  className?: string;
}) {
  return (
    <Card
      component="section"
      variant="outlined"
      className={className}
      sx={{ borderRadius: 2, overflow: "hidden" }}
    >
      {(title || description || toolbar) && (
        <>
          <CardHeader
            title={title}
            subheader={description}
            action={toolbar}
            titleTypographyProps={{ variant: "h5" }}
            subheaderTypographyProps={{ variant: "body2" }}
            sx={{
              px: { xs: 2, sm: 3 },
              py: 2.5,
              flexWrap: "wrap",
              gap: 2,
              "& .MuiCardHeader-content": { minWidth: 0 },
              "& .MuiCardHeader-action": {
                alignSelf: "center",
                m: 0,
                maxWidth: "100%",
              },
            }}
          />
          <Divider />
        </>
      )}
      <CardContent
        sx={{ p: flush ? 0 : 3, "&:last-child": { pb: flush ? 0 : 3 } }}
      >
        {children}
      </CardContent>
      {footer && (
        <>
          <Divider />
          <Box sx={{ px: 3, py: 2 }}>{footer}</Box>
        </>
      )}
    </Card>
  );
}

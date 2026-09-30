"use client";
import { useMemo, useEffect, useState } from "react";
import { ThemeProvider as ColorMode, useTheme } from "next-themes";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { createAbleTheme } from "@/interface/able-pro/theme";
function AbleTheme({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  const theme = useMemo(() => createAbleTheme(dark), [dark]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ key: "able", enableCssLayer: true }}>
      <ColorMode
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        storageKey="livraria-cloud-theme"
      >
        <AbleTheme>{children}</AbleTheme>
      </ColorMode>
    </AppRouterCacheProvider>
  );
}

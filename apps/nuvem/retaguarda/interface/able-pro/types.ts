import type { SimplePaletteColorOptions } from "@mui/material/styles";
export enum ThemeMode {
  LIGHT = "light",
  DARK = "dark",
}
export type PaletteThemeProps = Record<
  "primary" | "secondary" | "error" | "warning" | "info" | "success",
  SimplePaletteColorOptions
>;
declare module "@mui/material/styles" {
  interface SimplePaletteColorOptions {
    lighter?: string;
    darker?: string;
    100?: string;
    200?: string;
    400?: string;
    500?: string;
    700?: string;
    800?: string;
    900?: string;
  }
  interface PaletteColor {
    lighter?: string;
    darker?: string;
    100?: string;
    200?: string;
    400?: string;
    500?: string;
    700?: string;
    800?: string;
    900?: string;
  }
}
export const DRAWER_WIDTH = 280;
export const HEADER_HEIGHT = 74;

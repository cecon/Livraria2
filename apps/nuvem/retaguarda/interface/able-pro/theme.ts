import { alpha, createTheme } from "@mui/material/styles";
import { ptBR } from "@mui/material/locale";
import Palette from "./palette";
import Typography from "./typography";
import { ThemeMode, HEADER_HEIGHT } from "./types";
// Adapted from Able Pro 9.2.2 seed/themes: default palette, typography and component overrides.
export function createAbleTheme(dark: boolean) {
  const colors = Palette(dark ? ThemeMode.DARK : ThemeMode.LIGHT);
  return createTheme(
    {
      palette: {
        mode: dark ? "dark" : "light",
        ...colors,
        text: {
          primary: dark ? "#F3F5F7" : "#1D2630",
          secondary: dark ? "#BEC8D0" : "#5B6B79",
        },
        background: {
          default: dark ? "#131920" : "#F8F9FA",
          paper: dark ? "#1D2630" : "#fff",
        },
        divider: dark ? "#3E4853" : "#DBE0E5",
      },
      typography: Typography("Inter, sans-serif"),
      shape: { borderRadius: 8 },
      breakpoints: { values: { xs: 0, sm: 768, md: 1024, lg: 1266, xl: 1440 } },
      mixins: { toolbar: { minHeight: HEADER_HEIGHT } },
      components: {
        MuiButton: {
          defaultProps: { disableElevation: true },
          styleOverrides: {
            root: {
              textTransform: "none",
              fontWeight: 500,
              gap: 8,
              borderRadius: 8,
              minHeight: 38,
            },
            containedPrimary: {
              backgroundColor: dark ? colors.primary.main : colors.primary[900],
              color: dark ? "#131920" : "#fff",
            },
            containedSecondary: { color: dark ? "#131920" : "#fff" },
            textPrimary: {
              color: dark ? colors.primary.main : colors.primary[900],
            },
            sizeSmall: { minHeight: 32 },
            outlined: { borderColor: alpha(colors.secondary.main, 0.35) },
          },
        },
        MuiOutlinedInput: {
          styleOverrides: {
            root: {
              borderRadius: 8,
              backgroundColor: dark ? "#1D2630" : "#fff",
              fontSize: 14,
            },
            notchedOutline: { borderColor: dark ? "#5B6B79" : "#BEC8D0" },
            input: { padding: "10.5px 14px" },
          },
        },
        MuiPaper: {
          defaultProps: { elevation: 0 },
          styleOverrides: { root: { backgroundImage: "none" } },
        },
        MuiTableCell: {
          styleOverrides: {
            root: { padding: 12, fontSize: 14 },
            head: {
              fontSize: 12,
              fontWeight: 600,
              textTransform: "uppercase",
              backgroundColor: dark ? "#131920" : "#F8F9FA",
            },
          },
        },
        MuiTableRow: {
          styleOverrides: { root: { "&:last-child td": { borderBottom: 0 } } },
        },
        MuiDialog: {
          defaultProps: { fullWidth: true, maxWidth: "sm" },
          styleOverrides: { paper: { borderRadius: 12 } },
        },
        MuiChip: {
          styleOverrides: {
            outlinedPrimary: {
              color: dark ? colors.primary.main : colors.primary[900],
            },
          },
        },
        MuiTooltip: {
          defaultProps: { arrow: true },
          styleOverrides: {
            tooltip: { backgroundColor: "#1D2630", color: "#fff" },
            arrow: { color: "#1D2630" },
          },
        },
        MuiCssBaseline: {
          styleOverrides: {
            body: { fontFamily: "Inter, sans-serif" },
            "*:focus-visible": {
              outline: "2px solid #4680FF",
              outlineOffset: 2,
            },
          },
        },
      },
    },
    ptBR,
  );
}

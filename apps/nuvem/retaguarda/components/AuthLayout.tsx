"use client";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  IconButton,
  useTheme as useMuiTheme,
} from "@mui/material";
import { BookOpen, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
// Able Pro seed AuthWrapper/AuthCard: centered card, soft background accents and compact branding.
export function AuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { setTheme } = useTheme();
  const resolvedTheme = useMuiTheme().palette.mode;
  return (
    <Box
      component="main"
      sx={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          width: 350,
          height: 350,
          borderRadius: "50%",
          bgcolor: "primary.light",
          opacity: 0.12,
          filter: "blur(70px)",
          left: "-10%",
          top: "20%",
          pointerEvents: "none",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          width: 420,
          height: 420,
          borderRadius: "50%",
          bgcolor: "success.light",
          opacity: 0.1,
          filter: "blur(80px)",
          right: "-10%",
          bottom: 0,
          pointerEvents: "none",
        }}
      />
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ p: 3, zIndex: 1 }}
      >
        <Stack direction="row" gap={1.5} alignItems="center">
          <Box
            sx={{
              bgcolor: "primary.main",
              p: 1,
              borderRadius: 2,
              color: "white",
              display: "flex",
            }}
          >
            <BookOpen size={25} />
          </Box>
          <Typography variant="h5">Espaço do Livro</Typography>
        </Stack>
        <IconButton
          aria-label="Alternar tema"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {resolvedTheme === "dark" ? <Sun /> : <Moon />}
        </IconButton>
      </Stack>
      <Box
        sx={{
          flex: 1,
          display: "grid",
          placeItems: "center",
          px: 2,
          py: 5,
          zIndex: 1,
        }}
      >
        <Card
          variant="outlined"
          sx={{
            width: "100%",
            maxWidth: 480,
            borderRadius: 2,
            boxShadow: "0 8px 24px rgba(27,46,94,.05)",
          }}
        >
          <CardContent
            sx={{
              p: { xs: 3, sm: 5 },
              "&:last-child": { pb: { xs: 3, sm: 5 } },
            }}
          >
            <Typography variant="overline" color="text.secondary">
              Retaguarda
            </Typography>
            <Typography component="h1" variant="h3" sx={{ mt: 1 }}>
              {title}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
              {description}
            </Typography>
            {children}
          </CardContent>
        </Card>
      </Box>
      <Typography
        align="center"
        variant="caption"
        color="text.secondary"
        sx={{ p: 3 }}
      >
        Gestão da livraria
      </Typography>
    </Box>
  );
}

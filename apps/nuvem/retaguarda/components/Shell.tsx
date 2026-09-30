"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme as useMode } from "next-themes";
import {
  AppBar,
  Toolbar,
  Box,
  Typography,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  Tooltip,
  useMediaQuery,
  useTheme,
  Button,
  Breadcrumbs,
} from "@mui/material";
import {
  Menu as MenuIcon,
  Moon,
  Sun,
  LogOut,
  KeyRound,
  ChevronRight,
  Home,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { AppSidebar } from "./AppSidebar";
import { navigation } from "@/interface/able-pro/navigation";
import { DRAWER_WIDTH, HEADER_HEIGHT } from "@/interface/able-pro/types";
export function Shell({
  children,
  usuario,
}: {
  children: React.ReactNode;
  usuario: string | null;
}) {
  const path = usePathname();
  const router = useRouter();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("md"));
  const { setTheme } = useMode();
  const resolvedTheme = theme.palette.mode;
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    setOpen(false);
    setAnchor(null);
  }, [path]);
  if (
    ["/login", "/trocar-senha", "/ia/conectar"].some((p) => path.startsWith(p))
  )
    return <>{children}</>;
  const width = desktop ? (compact ? 90 : DRAWER_WIDTH) : 0;
  const title =
    navigation.flatMap((g) => g.items).find((i) => i.href === path)?.label ??
    "Retaguarda";
  async function logout() {
    setLeaving(true);
    try {
      const r = await fetch("/api/logout", { method: "POST" });
      if (!r.ok) throw new Error();
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Não foi possível sair. Tente novamente.");
    } finally {
      setLeaving(false);
    }
  }
  return (
    <Box sx={{ display: "flex", minHeight: "100dvh" }}>
      <Box
        component="a"
        href="#conteudo"
        sx={{
          position: "fixed",
          left: 16,
          top: -100,
          zIndex: 1600,
          p: 2,
          bgcolor: "background.paper",
          "&:focus": { top: 8 },
        }}
      >
        Ir para o conteúdo
      </Box>
      <AppSidebar
        desktop={desktop}
        compact={compact}
        open={open}
        onClose={() => setOpen(false)}
      />
      <AppBar
        color="inherit"
        position="fixed"
        elevation={0}
        sx={{
          width: `calc(100% - ${width}px)`,
          ml: `${width}px`,
          borderBottom: "1px solid",
          borderColor: "divider",
          backgroundImage: "none",
        }}
      >
        <Toolbar sx={{ minHeight: `${HEADER_HEIGHT}px !important`, gap: 1 }}>
          <IconButton
            aria-label={
              desktop
                ? compact
                  ? "Expandir menu"
                  : "Recolher menu"
                : "Abrir menu"
            }
            onClick={() => (desktop ? setCompact(!compact) : setOpen(true))}
          >
            <MenuIcon size={22} />
          </IconButton>
          <Breadcrumbs
            separator={<ChevronRight size={14} />}
            sx={{ flex: 1, minWidth: 0 }}
            aria-label="Localização"
          >
            <Link href="/" aria-label="Início">
              <Home size={16} />
            </Link>
            <Typography color="text.primary" variant="body1">
              {title}
            </Typography>
          </Breadcrumbs>
          <Tooltip title="Pesquisar livros">
            <IconButton
              component={Link}
              href="/pesquisa"
              aria-label="Pesquisar livros"
            >
              <Search size={21} />
            </IconButton>
          </Tooltip>
          <Tooltip
            title={resolvedTheme === "dark" ? "Tema claro" : "Tema escuro"}
          >
            <IconButton
              aria-label="Alternar tema"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
            >
              {resolvedTheme === "dark" ? (
                <Sun size={21} />
              ) : (
                <Moon size={21} />
              )}
            </IconButton>
          </Tooltip>
          <Button
            color="inherit"
            aria-label="Menu da conta"
            aria-haspopup="menu"
            aria-expanded={Boolean(anchor)}
            onClick={(e) => setAnchor(e.currentTarget)}
            sx={{ minWidth: 0, p: 1, gap: 1 }}
          >
            <Avatar
              sx={{
                width: 34,
                height: 34,
                bgcolor: "primary.lighter",
                color: "primary.900",
                fontSize: 14,
              }}
            >
              {(usuario ?? "U").slice(0, 2).toUpperCase()}
            </Avatar>
            <Typography
              variant="subtitle2"
              sx={{
                display: { xs: "none", sm: "block" },
                maxWidth: 160,
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {usuario ?? "Minha conta"}
            </Typography>
          </Button>
          <Menu
            anchorEl={anchor}
            open={Boolean(anchor)}
            onClose={() => setAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <MenuItem component={Link} href="/trocar-senha">
              <ListItemIcon>
                <KeyRound size={18} />
              </ListItemIcon>
              Trocar senha
            </MenuItem>
            <MenuItem disabled={leaving} onClick={logout}>
              <ListItemIcon>
                <LogOut size={18} />
              </ListItemIcon>
              {leaving ? "Saindo…" : "Sair"}
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box
        sx={{
          flexGrow: 1,
          minWidth: 0,
          width: `calc(100% - ${width}px)`,
          pt: `${HEADER_HEIGHT}px`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box
          id="conteudo"
          component="main"
          className="admin-content"
          sx={{ flex: 1, minWidth: 0 }}
        >
          {children}
        </Box>
        <Box
          component="footer"
          sx={{
            px: 3,
            py: 2,
            display: "flex",
            justifyContent: "space-between",
            color: "text.secondary",
            gap: 2,
          }}
        >
          <Typography variant="caption">Espaço do Livro</Typography>
          <Typography variant="caption">Retaguarda</Typography>
        </Box>
      </Box>
    </Box>
  );
}

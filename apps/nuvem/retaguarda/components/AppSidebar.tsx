"use client";
import Link from "next/link";
import { alpha } from "@mui/material/styles";
import { usePathname } from "next/navigation";
import {
  Box,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Tooltip,
} from "@mui/material";
import { BookOpen } from "lucide-react";
import { navigation } from "@/interface/able-pro/navigation";
import { DRAWER_WIDTH, HEADER_HEIGHT } from "@/interface/able-pro/types";
export function AppSidebar({
  open,
  compact,
  desktop,
  onClose,
}: {
  open: boolean;
  compact: boolean;
  desktop: boolean;
  onClose: () => void;
}) {
  const path = usePathname();
  const mini = desktop && compact;
  const width = mini ? 90 : DRAWER_WIDTH;
  return (
    <Drawer
      variant={desktop ? "permanent" : "temporary"}
      open={desktop || open}
      onClose={onClose}
      sx={{
        width: desktop ? width : 0,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width,
          boxSizing: "border-box",
          borderRight: "1px solid",
          borderColor: "divider",
        },
      }}
    >
      <Box
        component={Link}
        href="/"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          height: HEADER_HEIGHT,
          flexShrink: 0,
          px: mini ? 3.5 : 3,
          color: "text.primary",
          textDecoration: "none",
        }}
      >
        <Box
          sx={{
            bgcolor: "primary.main",
            color: "white",
            p: 1,
            borderRadius: 2,
            display: "flex",
          }}
        >
          <BookOpen size={24} />
        </Box>
        {!mini && (
          <Box>
            <Typography variant="subtitle1">Espaço do Livro</Typography>
            <Typography variant="caption" color="text.secondary">
              Retaguarda
            </Typography>
          </Box>
        )}
      </Box>
      <Divider />
      <Box
        component="nav"
        aria-label="Menu principal"
        sx={{ flex: 1, overflowY: "auto", p: 1.5 }}
      >
        {navigation.map((group) => (
          <Box key={group.label} sx={{ mb: 1.5 }}>
            {!mini && (
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  px: 1.5,
                  pt: 1.5,
                  pb: 0.75,
                  fontWeight: 600,
                  color: "text.secondary",
                }}
              >
                {group.label}
              </Typography>
            )}
            <List component="div" disablePadding>
              {group.items.map(({ href, label, icon: Icon }) => (
                <Tooltip key={href} title={mini ? label : ""} placement="right">
                  <ListItemButton
                    component={Link}
                    href={href}
                    onClick={onClose}
                    selected={path === href}
                    aria-current={path === href ? "page" : undefined}
                    aria-label={mini ? label : undefined}
                    sx={{
                      borderRadius: 1,
                      mb: 0.5,
                      minHeight: 42,
                      px: 1.5,
                      "&.Mui-selected": {
                    bgcolor: theme => alpha(theme.palette.primary.main, 0.12),
                    color: "primary.900",
                      },
                      "&.Mui-selected .MuiListItemIcon-root": {
                    color: "primary.900",
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{ minWidth: mini ? 0 : 34, color: "text.secondary" }}
                    >
                      <Icon size={20} />
                    </ListItemIcon>
                    {!mini && (
                      <ListItemText
                        primary={label}
                        primaryTypographyProps={{ fontSize: 14 }}
                      />
                    )}
                  </ListItemButton>
                </Tooltip>
              ))}
            </List>
          </Box>
        ))}
      </Box>
      {!mini && (
        <Box
          sx={{ m: 2, p: 1.5, bgcolor: "background.default", borderRadius: 2 }}
        >
          <Typography variant="caption" color="text.secondary">
            Espaço do Livro · Gestão
          </Typography>
        </Box>
      )}
    </Drawer>
  );
}

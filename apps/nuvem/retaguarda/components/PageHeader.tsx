"use client";
import Link from "next/link";
import {
  Box,
  Breadcrumbs,
  ButtonBase,
  IconButton,
  Typography,
} from "@mui/material";
import { ArrowLeft, ChevronRight, Home } from "lucide-react";
import type { ReactNode } from "react";

type Crumb = { label: string; href?: string; onClick?: () => void };
export function PageHeader({
  title,
  description,
  crumbs,
  action,
  back,
}: {
  title: string;
  description?: string;
  crumbs: Crumb[];
  action?: ReactNode;
  back?: Crumb;
}) {
  return (
    <Box component="header" sx={{ display: "grid", gap: 2 }}>
      <Breadcrumbs
        aria-label="Navegação estrutural"
        separator={<ChevronRight size={14} />}
        sx={{ fontSize: 12 }}
      >
        <IconButton component={Link} href="/" aria-label="Início" size="small">
          <Home size={15} />
        </IconButton>
        {crumbs.map((crumb, index) =>
          index === crumbs.length - 1 ? (
            <Typography
              key={index}
              variant="caption"
              color="text.primary"
              aria-current="page"
            >
              {crumb.label}
            </Typography>
          ) : crumb.href ? (
            <Link key={index} href={crumb.href}>
              {crumb.label}
            </Link>
          ) : crumb.onClick ? (
            <ButtonBase key={index} onClick={crumb.onClick}>
              {crumb.label}
            </ButtonBase>
          ) : (
            <Typography key={index} variant="caption">
              {crumb.label}
            </Typography>
          ),
        )}
      </Breadcrumbs>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: 1.5,
            minWidth: 0,
          }}
        >
          {back &&
            (back.href ? (
              <IconButton
                component={Link}
                href={back.href}
                aria-label={back.label}
              >
                <ArrowLeft size={20} />
              </IconButton>
            ) : (
              <IconButton onClick={back.onClick} aria-label={back.label}>
                <ArrowLeft size={20} />
              </IconButton>
            ))}
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h1" variant="h3">
              {title}
            </Typography>
            {description && (
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ mt: 1, maxWidth: 700 }}
              >
                {description}
              </Typography>
            )}
          </Box>
        </Box>
        {action && (
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 1,
            }}
          >
            {action}
          </Box>
        )}
      </Box>
    </Box>
  );
}

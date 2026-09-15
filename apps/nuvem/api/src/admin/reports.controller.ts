import { Controller, Get, Inject, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthRequest } from "../auth/principal";
import { admin } from "../sync/validation";
import { ReportsService } from "./reports.service";

@Controller("admin/relatorios")
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reports: ReportsService) {}
  @Get("estoque")
  stock(@Req() req: AuthRequest) { admin(req.principal); return this.reports.stock(); }
  @Get("destinacoes")
  destinations(@Req() req: AuthRequest, @Query("inicio") start?: string, @Query("fim") end?: string) {
    admin(req.principal); return this.reports.destinations(start, end);
  }
  @Get("vendas")
  sales(@Req() req: AuthRequest, @Query("data") date?: string, @Query("periodo") period?: string) {
    admin(req.principal); return this.reports.sales(date, period);
  }
  @Get("dashboard")
  dashboard(@Req() req: AuthRequest, @Query("periodo") period?: string) {
    admin(req.principal); return this.reports.dashboard(period);
  }
}

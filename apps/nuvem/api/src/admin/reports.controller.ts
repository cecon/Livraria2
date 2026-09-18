import { Controller, Get, Inject, Query, Req, StreamableFile, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthRequest } from "../auth/principal";
import { admin } from "../sync/validation";
import { ReportsService } from "./reports.service";
import { stockPdf, stockWorkbook } from "./stock-export";

@Controller("admin/relatorios")
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reports: ReportsService) {}
  private stockFilename(extension: string) {
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    return `attachment; filename="estoque-${day}.${extension}"`;
  }
  @Get("estoque")
  stock(@Req() req: AuthRequest) { admin(req.principal); return this.reports.stock(); }
  @Get("estoque/pdf")
  async stockPdf(@Req() req: AuthRequest) {
    admin(req.principal);
    const bytes = await stockPdf(await this.reports.stock());
    return new StreamableFile(bytes, { type: "application/pdf",
      disposition: this.stockFilename("pdf") });
  }
  @Get("estoque/xlsx")
  async stockXlsx(@Req() req: AuthRequest) {
    admin(req.principal);
    const bytes = await stockWorkbook(await this.reports.stock());
    return new StreamableFile(bytes, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      disposition: this.stockFilename("xlsx") });
  }
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

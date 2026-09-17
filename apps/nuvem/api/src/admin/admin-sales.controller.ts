import { Controller, Get, Inject, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthRequest } from "../auth/principal";
import { admin } from "../sync/validation";
import { AdminSalesService } from "./admin-sales.service";

@Controller("admin/vendas")
@UseGuards(AuthGuard)
export class AdminSalesController {
  constructor(@Inject(AdminSalesService) private readonly sales: AdminSalesService) {}
  @Get("hoje")
  today(@Req() req: AuthRequest) { admin(req.principal); return this.sales.today(); }
}

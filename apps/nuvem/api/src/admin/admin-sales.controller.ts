import { Body, Controller, Get, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthRequest } from "../auth/principal";
import { admin } from "../sync/validation";
import { AdminSalesService } from "./admin-sales.service";

@Controller("admin/vendas")
@UseGuards(AuthGuard)
export class AdminSalesController {
  constructor(@Inject(AdminSalesService) private readonly sales: AdminSalesService) {}
  @Post()
  create(@Req() req: AuthRequest, @Body() body: unknown) {
    admin(req.principal); return this.sales.create(body, req.principal.uid);
  }
  @Get("hoje")
  today(@Req() req: AuthRequest) { admin(req.principal); return this.sales.today(); }
}

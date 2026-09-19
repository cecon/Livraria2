import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthRequest } from "../auth/principal";
import { admin, device } from "../sync/validation";
import { PdvProductsService } from "./pdv-products.service";

@Controller("produtos-pdv")
@UseGuards(AuthGuard)
export class PdvProductsController {
  constructor(@Inject(PdvProductsService) private readonly products: PdvProductsService) {}
  @Get("codigo")
  async exact(@Req() req: AuthRequest, @Query("codigo") codigo: string) {
    if (req.principal.tipo === "pdv") device(req.principal); else admin(req.principal);
    return { produto: await this.products.exact(codigo) };
  }
  @Get(":uid")
  async get(@Req() req: AuthRequest, @Param("uid") uid: string) {
    if (req.principal.tipo === "pdv") device(req.principal); else admin(req.principal);
    return { produto: await this.products.get(uid) };
  }
  @Post()
  save(@Req() req: AuthRequest, @Body() body: Record<string, unknown>) {
    admin(req.principal);
    return this.products.execute(body, req.principal.uid);
  }
}

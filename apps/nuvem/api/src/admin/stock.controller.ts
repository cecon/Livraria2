import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthRequest } from "../auth/principal";
import { admin } from "../sync/validation";
import { StockService } from "./stock.service";

@Controller("admin/estoque")
@UseGuards(AuthGuard)
export class StockController {
  constructor(@Inject(StockService) private readonly stock: StockService) {}

  @Get("saldos")
  balances(@Req() request: AuthRequest) {
    admin(request.principal);
    return this.stock.balances();
  }

  @Get("livros/:uid/movimentos")
  movements(@Req() request: AuthRequest, @Param("uid") uid: string) {
    admin(request.principal);
    return this.stock.movements(uid);
  }

  @Post("ajustes")
  adjust(@Req() request: AuthRequest, @Body() body: unknown) {
    admin(request.principal);
    return this.stock.adjust(body, request.principal.uid);
  }

  @Post("contagens")
  count(@Req() request: AuthRequest, @Body() body: unknown) {
    admin(request.principal);
    return this.stock.count(body, request.principal.uid);
  }
}

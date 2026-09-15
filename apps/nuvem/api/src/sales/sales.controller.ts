import { Body, Controller, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthRequest } from "../auth/principal";
import { device, uuid } from "../sync/validation";
import { SalesService } from "./sales.service";
import { validateSale } from "./validate-sale";

@Controller("sync/vendas")
@UseGuards(AuthGuard)
export class SalesController {
  constructor(@Inject(SalesService) private readonly sales: SalesService) {}

  @Post()
  receive(@Req() req: AuthRequest, @Body() body: unknown) {
    return this.sales.receive(device(req.principal), validateSale(body));
  }

  @Post(":uid/cancelamento")
  cancel(@Req() req: AuthRequest, @Param("uid") uid: string) {
    return this.sales.cancel(device(req.principal), uuid(uid));
  }
}

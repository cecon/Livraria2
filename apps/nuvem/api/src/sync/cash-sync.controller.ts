import { Body, Controller, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthRequest } from "../auth/principal";
import { device } from "./validation";
import { CashSyncService } from "./cash-sync.service";

@Controller("sync/caixa-movimentos")
@UseGuards(AuthGuard)
export class CashSyncController {
  constructor(@Inject(CashSyncService) private readonly cash: CashSyncService) {}

  @Post()
  receive(@Req() req: AuthRequest, @Body() body: unknown) {
    return this.cash.receive(device(req.principal), body);
  }
}

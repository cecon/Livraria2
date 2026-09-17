import { Body, Controller, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthRequest } from "../auth/principal";
import { device, uuid } from "./validation";
import { ShiftSyncService } from "./shift-sync.service";

@Controller("sync/turnos")
@UseGuards(AuthGuard)
export class ShiftSyncController {
  constructor(@Inject(ShiftSyncService) private readonly shifts: ShiftSyncService) {}

  @Post()
  open(@Req() req: AuthRequest, @Body() body: unknown) {
    return this.shifts.open(device(req.principal), body);
  }

  @Post(":uid/encerramento")
  close(@Req() req: AuthRequest, @Param("uid") uid: string, @Body() body: unknown) {
    return this.shifts.close(device(req.principal), uuid(uid), body);
  }
}

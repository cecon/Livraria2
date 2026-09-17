import { Controller, Get, Inject, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthRequest } from "../auth/principal";
import { admin } from "../sync/validation";
import { ShiftsService } from "./shifts.service";

@Controller("admin/turnos")
@UseGuards(AuthGuard)
export class ShiftsController {
  constructor(@Inject(ShiftsService) private readonly shifts: ShiftsService) {}

  @Get()
  history(@Req() req: AuthRequest) {
    admin(req.principal);
    return this.shifts.history();
  }
}

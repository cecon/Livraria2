import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthRequest } from "../auth/principal";
import { admin, uuid } from "../sync/validation";
import { ShiftsService } from "./shifts.service";

@Controller("admin/turnos")
@UseGuards(AuthGuard)
export class ShiftsController {
  constructor(@Inject(ShiftsService) private readonly shifts: ShiftsService) {}

  @Get()
  history(@Req() req: AuthRequest) { admin(req.principal); return this.shifts.history(req.principal.uid); }

  @Get("aberto")
  current(@Req() req: AuthRequest) { admin(req.principal); return this.shifts.current(req.principal.uid); }

  @Post()
  create(@Req() req: AuthRequest, @Body() body: Record<string, unknown>) {
    admin(req.principal); return this.shifts.create(uuid(body?.sync_uid), body, req.principal.uid);
  }

  @Get(":uid/resumo")
  summary(@Req() req: AuthRequest, @Param("uid") uid: string) {
    admin(req.principal); return this.shifts.summary(uid, req.principal.uid);
  }

  @Get(":uid/pedidos/contagem")
  count(@Req() req: AuthRequest, @Param("uid") uid: string) {
    admin(req.principal); return this.shifts.orderCount(uid, req.principal.uid);
  }

  @Post(":uid/encerramento")
  close(@Req() req: AuthRequest, @Param("uid") uid: string, @Body() body: unknown) {
    admin(req.principal); return this.shifts.close(uid, body, req.principal.uid);
  }
}

import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthRequest } from "../auth/principal";
import { admin, uuid } from "../sync/validation";
import { SuppliersService } from "./suppliers.service";
import { FormsService } from "./forms.service";

@Controller("admin/fornecedores")
@UseGuards(AuthGuard)
export class SuppliersController {
  constructor(@Inject(SuppliersService) private readonly service: SuppliersService) {}
  @Get()
  list(@Req() req: AuthRequest, @Query("after") after?: string) { admin(req.principal); return this.service.list(after); }
  @Post()
  create(@Req() req: AuthRequest, @Body() body: Record<string, unknown>) {
    admin(req.principal); return this.service.save(uuid(body?.sync_uid), body, req.principal.uid, true);
  }
  @Put(":uid")
  update(@Req() req: AuthRequest, @Param("uid") uid: string, @Body() body: unknown) {
    admin(req.principal); return this.service.save(uid, body, req.principal.uid, false);
  }
  @Delete(":uid")
  remove(@Req() req: AuthRequest, @Param("uid") uid: string) { admin(req.principal); return this.service.remove(uid); }
}

@Controller("admin/formas")
@UseGuards(AuthGuard)
export class FormsController {
  constructor(@Inject(FormsService) private readonly service: FormsService) {}
  @Get()
  list(@Req() req: AuthRequest, @Query("after") after?: string) { admin(req.principal); return this.service.list(after); }
  @Post()
  create(@Req() req: AuthRequest, @Body() body: Record<string, unknown>) {
    admin(req.principal); return this.service.save(uuid(body?.sync_uid), body, req.principal.uid, true);
  }
  @Put("reordenar")
  reorder(@Req() req: AuthRequest, @Body() body: unknown) { admin(req.principal); return this.service.reorder(body); }
  @Put(":uid/ativa")
  active(@Req() req: AuthRequest, @Param("uid") uid: string, @Body() body: unknown) {
    admin(req.principal); return this.service.active(uid, body);
  }
  @Put(":uid")
  update(@Req() req: AuthRequest, @Param("uid") uid: string, @Body() body: unknown) {
    admin(req.principal); return this.service.save(uid, body, req.principal.uid, false);
  }
  @Delete(":uid")
  remove(@Req() req: AuthRequest, @Param("uid") uid: string) { admin(req.principal); return this.service.remove(uid); }
}

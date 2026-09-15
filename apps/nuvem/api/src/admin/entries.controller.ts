import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthRequest } from "../auth/principal";
import { admin, uuid } from "../sync/validation";
import { EntriesService } from "./entries.service";

@Controller("admin/lancamentos")
@UseGuards(AuthGuard)
export class EntriesController {
  constructor(@Inject(EntriesService) private readonly entries: EntriesService) {}

  @Get()
  list(@Req() req: AuthRequest) { admin(req.principal); return this.entries.list(); }

  @Post()
  create(@Req() req: AuthRequest, @Body() body: Record<string, unknown>) {
    admin(req.principal); return this.entries.create(uuid(body?.sync_uid), req.principal.uid);
  }

  @Get(":uid")
  get(@Req() req: AuthRequest, @Param("uid") uid: string) {
    admin(req.principal); return this.entries.get(uid);
  }

  @Put(":uid")
  update(@Req() req: AuthRequest, @Param("uid") uid: string, @Body() body: unknown) {
    admin(req.principal); return this.entries.update(uid, body);
  }

  @Delete(":uid")
  remove(@Req() req: AuthRequest, @Param("uid") uid: string) {
    admin(req.principal); return this.entries.remove(uid);
  }

  @Post(":uid/itens")
  addItem(@Req() req: AuthRequest, @Param("uid") uid: string, @Body() body: unknown) {
    admin(req.principal); return this.entries.addItem(uid, body, req.principal.uid);
  }

  @Delete(":uid/itens/:itemUid")
  removeItem(@Req() req: AuthRequest, @Param("uid") uid: string, @Param("itemUid") itemUid: string) {
    admin(req.principal); return this.entries.removeItem(uid, itemUid);
  }

  @Post(":uid/finalizacao")
  finalize(@Req() req: AuthRequest, @Param("uid") uid: string) {
    admin(req.principal); return this.entries.finalize(uid, req.principal.uid);
  }

  @Post(":uid/cancelamento")
  cancel(@Req() req: AuthRequest, @Param("uid") uid: string) {
    admin(req.principal); return this.entries.cancel(uid, req.principal.uid);
  }
}

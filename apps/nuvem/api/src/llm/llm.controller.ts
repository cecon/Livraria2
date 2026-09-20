import { Body, Controller, Get, Inject, Param, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { randomUUID } from "node:crypto";
import { AuthGuard } from "../auth/auth.guard";
import { AuthRequest } from "../auth/principal";
import { ShiftContextService } from "../auth/shift-context.service";
import { admin, uuid } from "../sync/validation";
import { LlmService } from "./llm.service";

@Controller("admin/llms")
@UseGuards(AuthGuard)
export class LlmAdminController {
  constructor(@Inject(LlmService) private readonly service: LlmService,
    @Inject(ShiftContextService) private readonly context: ShiftContextService) {}
  @Get()
  list(@Req() req: AuthRequest) { admin(req.principal); return this.service.list(); }
  @Post()
  create(@Req() req: AuthRequest, @Body() body: unknown) {
    admin(req.principal); return this.service.save(randomUUID(), body, req.principal.uid, true);
  }
  @Put(":uid")
  update(@Req() req: AuthRequest, @Param("uid") uid: string, @Body() body: unknown) {
    admin(req.principal); return this.service.save(uuid(uid), body, req.principal.uid, false);
  }
  @Post(":uid/testar")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async test(@Req() req: AuthRequest, @Param("uid") uid: string) {
    admin(req.principal);
    return this.service.test(uuid(uid), await this.context.resolve(req.principal), true);
  }
}

@Controller("llms")
@UseGuards(AuthGuard)
export class LlmUsageController {
  constructor(@Inject(LlmService) private readonly service: LlmService,
    @Inject(ShiftContextService) private readonly context: ShiftContextService) {}
  @Get()
  async list(@Req() req: AuthRequest, @Query("turnoUid") turno: string) {
    return this.service.list(await this.context.resolve(req.principal, turno));
  }
  @Post(":uid/testar")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async test(@Req() req: AuthRequest, @Param("uid") uid: string, @Body() body: { turnoUid?: unknown } | null) {
    return this.service.test(uuid(uid), await this.context.resolve(req.principal, body?.turnoUid));
  }
}

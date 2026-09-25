import { Body, Controller, Get, Header, Inject, Param, Post, Req, Res, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Response } from "express";
import { AuthGuard } from "../auth/auth.guard";
import { AuthRequest } from "../auth/principal";
import { IaAccessService } from "./access.service";
import { IaCatalog } from "./catalog.service";
import { IaGateway } from "./gateway.service";

@Controller("ia")
export class IaController {
  constructor(@Inject(IaAccessService) private readonly access: IaAccessService,
    @Inject(IaCatalog) private readonly catalog: IaCatalog, @Inject(IaGateway) private readonly gateway: IaGateway) {}
  @Post("solicitacoes")
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  request(@Body() body: unknown) { return this.access.request(body); }
  @Get("solicitacoes/:uid")
  @Header("Cache-Control", "no-store")
  details(@Param("uid") id: string) { return this.access.details(id); }
  @Post("autorizar")
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  authorize(@Body() body: unknown) { return this.access.authorize(body); }
  @Get("catalogo")
  @Header("Cache-Control", "no-store")
  async document(@Req() req: AuthRequest) { return this.catalog.document(await this.access.authenticate(req.headers.authorization)); }
  @Post("executar")
  async execute(@Req() req: AuthRequest, @Body() body: unknown, @Res() response: Response) {
    const result = await this.gateway.execute(body, await this.access.authenticate(req.headers.authorization));
    response.status(result.status).set({ "Content-Type": result.type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    if (result.disposition) response.setHeader("Content-Disposition", result.disposition);
    response.send(result.bytes);
  }
  @Get("acessos")
  @UseGuards(AuthGuard)
  @Header("Cache-Control", "no-store")
  list(@Req() req: AuthRequest) { return this.access.list(req.principal); }
  @Post("acessos/:uid/revogar")
  @UseGuards(AuthGuard)
  revoke(@Req() req: AuthRequest, @Param("uid") id: string) { return this.access.revoke(id, req.principal); }
  @Get("acessos/:uid/historico")
  @UseGuards(AuthGuard)
  @Header("Cache-Control", "no-store")
  history(@Req() req: AuthRequest, @Param("uid") id: string) { return this.access.history(id, req.principal); }
}

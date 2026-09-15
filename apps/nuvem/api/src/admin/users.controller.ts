import { Body, Controller, Get, Inject, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthRequest } from "../auth/principal";
import { admin } from "../sync/validation";
import { UsersService } from "./users.service";

@Controller("admin/usuarios")
@UseGuards(AuthGuard)
export class UsersController {
  constructor(@Inject(UsersService) private readonly service: UsersService) {}
  @Get()
  list(@Req() request: AuthRequest) { admin(request.principal); return this.service.list(); }
  @Post()
  create(@Req() request: AuthRequest, @Body() body: unknown) {
    admin(request.principal); return this.service.create(body, request.principal.uid);
  }
  @Put(":usuario/senha")
  password(@Req() request: AuthRequest, @Param("usuario") usuario: string, @Body() body: unknown) {
    admin(request.principal); return this.service.password(usuario, body);
  }
  @Put(":usuario/ativa")
  active(@Req() request: AuthRequest, @Param("usuario") usuario: string, @Body() body: unknown) {
    admin(request.principal); return this.service.active(usuario, body);
  }
  @Put(":usuario")
  update(@Req() request: AuthRequest, @Param("usuario") usuario: string, @Body() body: unknown) {
    admin(request.principal); return this.service.update(usuario, body);
  }
}

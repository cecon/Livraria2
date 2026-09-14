import { Body, Controller, Get, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthGuard } from "./auth.guard";
import { AuthRequest } from "./principal";
import { Throttle } from "@nestjs/throttler";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post("login")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  login(@Body() body: { usuario?: unknown; senha?: unknown }) {
    return this.auth.login(body?.usuario, body?.senha);
  }

  @Get("me")
  @UseGuards(AuthGuard)
  me(@Req() request: AuthRequest) {
    return request.principal;
  }

  @Post("pdv/renovar")
  renew(@Body() body: { pdvUid?: unknown; refreshToken?: unknown }) {
    return this.auth.renewDevice(body?.pdvUid, body?.refreshToken);
  }
}

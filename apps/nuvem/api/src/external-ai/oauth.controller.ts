import { Body, Controller, Get, Header, HttpCode, HttpException, Inject, Post, Query, Req, Res, UnauthorizedException } from "@nestjs/common";
import { Response } from "express";
import { AuthRequest } from "../auth/principal";
import { IaAccessService } from "./access.service";

function publicUrls(req: AuthRequest) {
  const origin = String(req.headers["x-ia-public-origin"] || "");
  const fallbackProto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0];
  const fallbackHost = String(req.headers["x-forwarded-host"] || req.headers.host || "127.0.0.1:3001").split(",")[0];
  const base = origin || `${fallbackProto}://${fallbackHost}`;
  return { issuer: base, endpointsBase: `${base}/api/ia`, resource: `${base}/mcp` };
}

@Controller("ia/oauth")
export class IaOAuthController {
  constructor(@Inject(IaAccessService) private readonly access: IaAccessService) {}

  @Get("protected-resource")
  @Header("Cache-Control", "no-store")
  protected(@Req() req: AuthRequest) {
    const urls = publicUrls(req);
    return this.access.protectedResource(urls.resource, urls.issuer);
  }

  @Get("metadata")
  @Header("Cache-Control", "no-store")
  metadata(@Req() req: AuthRequest) {
    const urls = publicUrls(req);
    return this.access.authorizationServer(urls.issuer, urls.endpointsBase);
  }

  @Post("register")
  @Header("Cache-Control", "no-store")
  register(@Body() body: unknown) {
    return this.access.registerClient(body);
  }

  @Get("authorize")
  @Header("Cache-Control", "no-store")
  async authorize(@Query() query: Record<string, unknown>, @Res() res: Response) {
    await this.access.authorizePage(query);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (typeof value === "string") params.set(key, value);
    res.redirect(302, `/ia/conectar?${params.toString()}`);
  }

  @Post("authorize")
  @Header("Cache-Control", "no-store")
  async authorizeConfirm(@Req() req: AuthRequest, @Body() body: unknown, @Res() res: Response) {
    try {
      const result = await this.access.authorizeOAuth(body, publicUrls(req).issuer);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new UnauthorizedException("Autorização OAuth inválida.");
    }
  }

  @Post("token")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  token(@Body() body: unknown) {
    return this.access.token(body);
  }
}

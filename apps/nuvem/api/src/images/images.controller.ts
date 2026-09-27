import { Body, Controller, Get, Inject, Param, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { AuthGuard } from "../auth/auth.guard";
import { AuthRequest } from "../auth/principal";
import { admin, device } from "../sync/validation";
import { ImagesService } from "./images.service";

@Controller("capas")
export class ImagesController {
  constructor(@Inject(ImagesService) private readonly images: ImagesService) {}
  @Post()
  @UseGuards(AuthGuard)
  upload(@Req() req: AuthRequest, @Body() body: { imagem?: unknown }) {
    if (req.principal.tipo === "pdv") device(req.principal); else admin(req.principal);
    return this.images.upload(body?.imagem, req.principal.uid);
  }
  // Capas são mídia pública de catálogo, sem listagem pública de arquivos.
  @Get(":uid")
  async read(@Param("uid") uid: string, @Res() res: Response) {
    const bytes = await this.images.read(uid);
    res.set({ "Content-Type": "image/webp", "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable", "Content-Length": String(bytes.length) });
    res.send(bytes);
  }
}

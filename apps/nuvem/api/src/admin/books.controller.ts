import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthRequest } from "../auth/principal";
import { admin, uuid } from "../sync/validation";
import { BooksService } from "./books.service";

@Controller("admin/livros")
@UseGuards(AuthGuard)
export class BooksController {
  constructor(@Inject(BooksService) private readonly books: BooksService) {}

  @Get()
  list(@Req() req: AuthRequest, @Query("after") after?: string, @Query("inativos") inativos?: string,
    @Query("busca") busca?: string, @Query("codigo") codigo?: string, @Query("titulo") titulo?: string,
    @Query("limite") limite?: string, @Query("resumo") resumo?: string) {
    admin(req.principal);
    return this.books.list({ after, includeInactive: inativos === "1", search: busca, code: codigo, title: titulo,
      limit: limite, summary: resumo === "1" });
  }

  @Get(":uid")
  get(@Req() req: AuthRequest, @Param("uid") uid: string) {
    admin(req.principal);
    return this.books.get(uid);
  }

  @Post()
  create(@Req() req: AuthRequest, @Body() body: Record<string, unknown>) {
    admin(req.principal);
    return this.books.save(uuid(body?.sync_uid), body, req.principal.uid, true);
  }

  @Put(":uid")
  update(@Req() req: AuthRequest, @Param("uid") uid: string, @Body() body: unknown) {
    admin(req.principal);
    return this.books.save(uid, body, req.principal.uid, false);
  }

  @Delete(":uid")
  remove(@Req() req: AuthRequest, @Param("uid") uid: string) {
    admin(req.principal);
    return this.books.remove(uid);
  }
}

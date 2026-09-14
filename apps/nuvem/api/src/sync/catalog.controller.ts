import { Body, Controller, Get, Inject, Post, Query, Req, UseGuards } from "@nestjs/common";
import { BadRequestException, ConflictException, UnprocessableEntityException } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthRequest } from "../auth/principal";
import { PrismaService } from "../database/prisma.service";
import { cursor, device } from "./validation";

interface Device { aplicado: bigint; entregue: bigint }
interface Event { sequencia: bigint; produtoUid: string; operacao: string; produto: unknown }

@Controller("sync/catalogo")
@UseGuards(AuthGuard)
export class CatalogController {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  @Get()
  async page(@Req() req: AuthRequest, @Query("cursor") value?: string, @Query("limite") size?: string) {
    const uid = device(req.principal);
    const limit = size === undefined ? 100 : Number(size);
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      throw new BadRequestException("Limite invalido");
    }
    return this.db.$transaction(async tx => {
      const rows = await tx.$queryRaw<Device[]>`
        select cursor_aplicado as aplicado, cursor_entregue as entregue
        from public.nuvem_pdv where uid = ${uid}::uuid and ativo for update`;
      if (!rows[0]) throw new ConflictException("Dispositivo indisponivel");
      const start = value === undefined ? rows[0].aplicado : cursor(value);
      if (start !== rows[0].aplicado) throw new ConflictException("Cursor nao confirmado");
      const events = await tx.$queryRaw<Event[]>`
        select sequencia, produto_uid::text as "produtoUid", operacao, produto
        from public.nuvem_catalogo_evento where sequencia > ${start}
        order by sequencia limit ${limit + 1}`;
      const page = events.slice(0, limit);
      for (const event of page) {
        if (event.operacao === "upsert") {
          const price = (event.produto as { precoCentavos?: unknown })?.precoCentavos;
          if (typeof price !== "number" || !Number.isSafeInteger(price) || price < 0) {
            throw new UnprocessableEntityException("Preco fora do contrato em centavos");
          }
        }
      }
      const next = page.at(-1)?.sequencia ?? start;
      await tx.$executeRaw`
        update public.nuvem_pdv set cursor_entregue = ${next}
        where uid = ${uid}::uuid`;
      return {
        versao: 1,
        alteracoes: page.map(e => ({
          sequencia: e.sequencia.toString(), produtoUid: e.produtoUid,
          operacao: e.operacao, ...(e.produto ? { produto: e.produto } : {}),
        })),
        proximoCursor: next.toString(), temMais: events.length > limit,
      };
    });
  }

  @Post("confirmacao")
  async acknowledge(@Req() req: AuthRequest, @Body() body: { cursorAplicado?: unknown }) {
    const uid = device(req.principal);
    const applied = cursor(body?.cursorAplicado);
    return this.db.$transaction(async tx => {
      const rows = await tx.$queryRaw<Device[]>`
        select cursor_aplicado as aplicado, cursor_entregue as entregue
        from public.nuvem_pdv where uid = ${uid}::uuid and ativo for update`;
      const row = rows[0];
      if (!row || applied < row.aplicado ||
        (applied !== row.aplicado && applied !== row.entregue)) {
        throw new ConflictException("Cursor nao entregue");
      }
      await tx.$executeRaw`
        update public.nuvem_pdv set cursor_aplicado = ${applied}, confirmado_em = now()
        where uid = ${uid}::uuid`;
      return { pdvUid: uid, cursorAplicado: applied.toString() };
    });
  }
}

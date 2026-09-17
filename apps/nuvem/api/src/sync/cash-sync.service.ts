import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { uuid } from "./validation";

type Row = { turno_uid: string; operador_uid: string; tipo: string; valor_centavos: bigint;
  motivo: string; criado_em: string; pdv_uid: string };

@Injectable()
export class CashSyncService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async receive(pdv: string, value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new BadRequestException("Movimento invalido");
    const body = value as Record<string, unknown>;
    const uid = uuid(body.movimentoUid);
    const shiftUid = uuid(body.turnoUid);
    const operatorUid = uuid(body.operadorUid);
    if (body.tipo !== "sangria" && body.tipo !== "suprimento") throw new BadRequestException("Tipo invalido");
    if (!Number.isSafeInteger(body.valorCentavos) || (body.valorCentavos as number) <= 0) {
      throw new BadRequestException("Valor invalido");
    }
    if (typeof body.motivo !== "string" || !body.motivo.trim() || body.motivo.length > 500 ||
      typeof body.criadoEm !== "string" || Number.isNaN(Date.parse(body.criadoEm))) {
      throw new BadRequestException("Motivo ou data invalido");
    }
    const amount = BigInt(body.valorCentavos as number);
    return this.db.$transaction(async tx => {
      const rows = await tx.$queryRaw<Row[]>`
        select m.turno_uid::text, m.operador_uid::text, m.tipo, m.valor_centavos,
          m.motivo, m.criado_em, t.pdv_uid::text
        from public.caixa_movimento m join public.turno_operacao t on t.sync_uid=m.turno_uid
        where m.sync_uid=${uid}::uuid for update`;
      if (rows[0]) {
        const m = rows[0];
        if (m.pdv_uid !== pdv || m.turno_uid !== shiftUid || m.operador_uid !== operatorUid ||
          m.tipo !== body.tipo || m.valor_centavos !== amount || m.motivo !== body.motivo ||
          m.criado_em !== body.criadoEm) throw new ConflictException("Movimento ja recebido com outros dados");
        return { movimentoUid: uid, recebido: true };
      }
      const shifts = await tx.$queryRaw<{ pdv_uid: string | null; operador_uid: string | null }[]>`
        select pdv_uid::text, operador_uid::text from public.turno_operacao
        where sync_uid=${shiftUid}::uuid`;
      if (!shifts[0] || shifts[0].pdv_uid !== pdv || shifts[0].operador_uid !== operatorUid) {
        throw new ConflictException("Turno ou usuario nao pertencem a esta maquina");
      }
      await tx.$executeRaw`
        insert into public.caixa_movimento(sync_uid,turno_uid,operador_uid,tipo,valor_centavos,motivo,criado_em)
        values(${uid}::uuid,${shiftUid}::uuid,${operatorUid}::uuid,${body.tipo},
          ${amount},${body.motivo},${body.criadoEm})`;
      return { movimentoUid: uid, recebido: true };
    });
  }
}

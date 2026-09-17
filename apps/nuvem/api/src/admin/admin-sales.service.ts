import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";

function integer(value: bigint, label: string): number {
  if (value < BigInt(Number.MIN_SAFE_INTEGER) || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new ConflictException(`${label} fora do contrato; reconciliacao necessaria`);
  }
  return Number(value);
}

interface SaleRow {
  sync_uid: string;
  numero_no_turno: bigint | null;
  numero: bigint;
  cliente: string;
  total_centavos: bigint;
  cancelado: boolean;
  maquina: string;
  operador: string;
  recebido_em: Date;
}

@Injectable()
export class AdminSalesService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async today() {
    const rows = await this.db.$queryRaw<SaleRow[]>`
      select p.sync_uid::text, p.numero_no_turno, p.numero, p.cliente,
        p.total_centavos, p.cancelado, coalesce(d.nome, 'Maquina indisponivel') as maquina,
        coalesce(u.nome, u.usuario, 'Operador indisponivel') as operador,
        p.sincronizado_em as recebido_em
      from public.pedido p
      join public.turno_operacao t on t.sync_uid=p.turno_uid and t.pdv_uid is not null
      left join public.nuvem_pdv d on d.uid=t.pdv_uid
      left join public.usuario u on u.sync_uid=p.operador_uid
      where p.data=to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM-DD')
        and p.origem='pdv' and p.excluido_em is null
      order by p.sincronizado_em desc limit 200`;
    return rows.map(row => ({ sync_uid: row.sync_uid,
      numeroNoTurno: row.numero_no_turno === null ? null : integer(row.numero_no_turno, "Numero do turno"),
      numero: integer(row.numero, "Numero"), cliente: row.cliente,
      totalCentavos: integer(row.total_centavos, "Total"), cancelado: row.cancelado,
      maquina: row.maquina, operador: row.operador, recebidoEm: row.recebido_em }));
  }
}

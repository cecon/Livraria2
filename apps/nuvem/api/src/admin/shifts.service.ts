import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";

interface ShiftRow {
  sync_uid: string;
  maquina: string;
  operador: string;
  status: string;
  abertura: string;
  encerramento: string | null;
  caixa_inicial_centavos: string;
  esperado_centavos: string | null;
  conferido_centavos: string | null;
  diferenca_centavos: string | null;
  vendas: number;
  total_vendido_centavos: string;
}

@Injectable()
export class ShiftsService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async history() {
    const rows = await this.db.$queryRaw<ShiftRow[]>`
      select t.sync_uid::text, coalesce(d.nome, 'Maquina indisponivel') as maquina,
        coalesce(u.nome, u.usuario, 'Operador indisponivel') as operador,
        t.status, t.abertura, t.encerramento,
        t.caixa_inicial_centavos::text, t.esperado_centavos::text,
        t.conferido_centavos::text, t.diferenca_centavos::text,
        v.vendas, v.total_vendido_centavos::text
      from public.turno_operacao t
      left join public.nuvem_pdv d on d.uid=t.pdv_uid
      left join public.usuario u on u.sync_uid=t.operador_uid
      left join lateral (
        select count(*)::integer as vendas,
          coalesce(sum(p.total_centavos),0)::bigint as total_vendido_centavos
        from public.pedido p where p.turno_uid=t.sync_uid
          and not p.cancelado and p.excluido_em is null
      ) v on true
      where t.pdv_uid is not null and t.excluido_em is null
      order by case when t.status='aberto' then 0 else 1 end, t.abertura desc
      limit 100`;
    return rows.map(row => ({ sync_uid: row.sync_uid, maquina: row.maquina,
      operador: row.operador, status: row.status, abertura: row.abertura,
      encerramento: row.encerramento, caixaInicialCentavos: row.caixa_inicial_centavos,
      esperadoCentavos: row.esperado_centavos, conferidoCentavos: row.conferido_centavos,
      diferencaCentavos: row.diferenca_centavos, vendas: row.vendas,
      totalVendidoCentavos: row.total_vendido_centavos }));
  }
}

import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export type ProductSnapshot = {
  uid: string; codigo: string; titulo: string; autor: string | null;
  precoCentavos: number; categoria: number; descricao: string | null;
  saldoPublicado: number; ativo: boolean; excluido: boolean; versao: string;
};
type Row = Omit<ProductSnapshot, "precoCentavos" | "saldoPublicado"> & {
  precoCentavos: bigint; saldoPublicado: bigint;
};
export async function productSnapshot(tx: Prisma.TransactionClient, uid: string): Promise<ProductSnapshot | null> {
  const rows = await tx.$queryRaw<Row[]>`
    select l.sync_uid::text as uid, l.codigo,l.titulo,l.autor,l.preco_centavos as "precoCentavos",
      l.categoria,l.descricao,l.ativo,(l.excluido_em is not null) as excluido,
      coalesce(s.saldo,0)::bigint as "saldoPublicado",
      coalesce((select max(e.sequencia) from public.nuvem_catalogo_evento e
        where e.produto_uid=l.sync_uid),0)::text as versao
    from public.livro l left join public.vw_saldo_livro s on s.livro_uid=l.sync_uid
    where l.sync_uid=${uid}::uuid`;
  if (!rows[0]) return null;
  const row = rows[0];
  for (const n of [row.precoCentavos, row.saldoPublicado]) {
    if (n < BigInt(Number.MIN_SAFE_INTEGER) || n > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new ConflictException("Valor fora do contrato. Solicite conferência na retaguarda.");
    }
  }
  return { ...row, precoCentavos: Number(row.precoCentavos), saldoPublicado: Number(row.saldoPublicado) };
}

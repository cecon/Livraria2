import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import { uuid } from "../sync/validation";
import { bookInput } from "./book-input";
import { productSnapshot, ProductSnapshot } from "./pdv-products-read";

@Injectable()
export class PdvProductsService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async exact(codigo: unknown) {
    if (typeof codigo !== "string" || !codigo.trim() || codigo.length > 100) throw new BadRequestException();
    const book = await this.db.livro.findUnique({ where: { codigo: codigo.trim() }, select: { syncUid: true } });
    return book ? productSnapshot(this.db, book.syncUid) : null;
  }

  async get(id: string) {
    const result = await productSnapshot(this.db, uuid(id));
    if (!result) throw new NotFoundException("Produto não encontrado.");
    return result;
  }

  async execute(input: Record<string, unknown>, actor: string) {
    const op = uuid(input?.operacao);
    const uid = uuid(input?.uid);
    const action = input?.acao;
    if (!["criar", "editar", "contar"].includes(String(action))) throw new BadRequestException();
    const data = action !== "contar" ? bookInput(input.dados, action === "criar") : null;
    const quantity = input.quantidade;
    if (action === "contar" && (!Number.isSafeInteger(quantity) || (quantity as number) < 0)) {
      throw new BadRequestException("Informe uma quantidade inteira não negativa.");
    }
    if (action !== "criar" && (typeof input.versao !== "string" || !/^\d+$/.test(input.versao))) {
      throw new BadRequestException("Recarregue o produto antes de confirmar.");
    }
    const payload = JSON.stringify({ uid, action, data, quantity, version: input.versao },
      (_, value) => typeof value === "bigint" ? value.toString() : value);
    try {
      return await this.db.$transaction(async tx => {
        // All official writers take the publication lock first; ledger lock also
        // serializes legacy writers. Preview is compared inside the transaction.
        await tx.$queryRaw`select id from public.nuvem_sync_contador where id=1 for update`;
        await tx.$executeRaw`lock table public.movimento_estoque in share row exclusive mode`;
        const replay = await tx.$queryRaw<{ responsavel: string; igual: boolean; resultado: ProductSnapshot }[]>`
          select responsavel_uid::text as responsavel, pedido=${payload}::jsonb as igual, resultado
          from public.nuvem_produto_operacao where uid=${op}::uuid`;
        if (replay[0]) {
          if (!replay[0].igual || replay[0].responsavel !== actor) throw new ConflictException("Tentativa já utilizada com outros dados.");
          return await productSnapshot(tx, uid) ?? replay[0].resultado;
        }
        const before = await productSnapshot(tx, uid);
        const now = new Date();
        if (action === "criar" && data) {
          if (before) throw new ConflictException("Produto já cadastrado.");
          const { initial, ...fields } = data;
          await tx.livro.create({ data: { syncUid: uid, ...fields, ativo: initial > 0n,
            criadoPor: actor, origem: "nuvem", atualizadoEm: now, sincronizadoEm: now } });
          if (initial > 0n) await this.movement(tx, uid, initial, "saldo_inicial", actor, op, now);
        } else {
          if (!before || before.excluido) throw new NotFoundException("Produto indisponível.");
          if (before.versao !== input.versao) throw new ConflictException("PRODUTO_ALTERADO");
          if (action === "editar" && data) {
            const { initial: _initial, ...fields } = data;
            if (!before.ativo && fields.ativo && before.saldoPublicado <= 0) throw new ConflictException("Informe estoque positivo antes de ativar.");
            await tx.livro.update({ where: { syncUid: uid }, data: { ...fields, atualizadoEm: now, sincronizadoEm: now } });
          } else {
            const difference = BigInt(quantity as number) - BigInt(before.saldoPublicado);
            if (difference !== 0n) await this.movement(tx, uid, difference, "contagem", actor, op, now);
          }
        }
        const result = await productSnapshot(tx, uid);
        if (!result) throw new NotFoundException();
        await tx.$executeRaw`insert into public.nuvem_produto_operacao(uid,responsavel_uid,pedido,resultado)
          values(${op}::uuid,${actor}::uuid,${payload}::jsonb,${JSON.stringify(result)}::jsonb)`;
        return result;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") throw new ConflictException("Já existe produto com este código.");
      throw error;
    }
  }

  private async movement(tx: Prisma.TransactionClient, uid: string, qtd: bigint,
    tipo: string, actor: string, op: string, now: Date) {
    await tx.movimento_estoque.create({ data: { sync_uid: randomUUID(), livro_uid: uid, qtd, tipo,
      referencia: `pdv:${op}`, motivo: tipo === "contagem" ? "Contagem física individual no PDV" : null,
      criado_em: now.toISOString(), origem: "nuvem", criado_por: actor,
      atualizado_em: now, sincronizado_em: now } });
  }
}

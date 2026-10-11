import { BadRequestException, ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { uuid } from "../sync/validation";

export type BookListFilter = { uid?: string; after?: string; includeInactive?: boolean; search?: string; code?: string;
  title?: string; limit?: string; summary?: boolean };

const ACCENTS = "áàâãäéèêëíìîïóòôõöúùûüçñ";
const PLAIN = "aaaaaeeeeiiiiooooouuuucn";
const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
const column = (sql: Prisma.Sql) => Prisma.sql`translate(lower(coalesce(${sql},'')), ${ACCENTS}, ${PLAIN})`;
const like = (value: string) => `%${value.replace(/[\\%_]/g, char => `\\${char}`)}%`;

function text(value: string | undefined, label: string) {
  if (value === undefined || value === "") return undefined;
  if (value.length > 200) throw new BadRequestException(`${label} invalido`);
  return normalize(value) || undefined;
}

export function bookListLimit(value: string | undefined) {
  if (value === undefined || value === "") return 500;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new BadRequestException("Limite invalido");
  return limit;
}

// Busca do catálogo para web e IA: cada palavra da busca precisa aparecer em
// código, título, autor ou descrição, sem diferenciar acento ou caixa.
export function bookListWhere(filter: BookListFilter) {
  const conditions = [Prisma.sql`l.excluido_em is null`];
  if (!filter.includeInactive) conditions.push(Prisma.sql`l.ativo`);
  if (filter.uid) conditions.push(Prisma.sql`l.sync_uid = ${uuid(filter.uid)}::uuid`);
  if (filter.after) conditions.push(Prisma.sql`l.sync_uid > ${uuid(filter.after)}::uuid`);
  const haystack = column(Prisma.sql`l.codigo || ' ' || l.titulo || ' ' || coalesce(l.autor,'') || ' ' || coalesce(l.descricao,'')`);
  for (const word of (text(filter.search, "Busca") ?? "").split(/\s+/).filter(Boolean).slice(0, 8)) {
    conditions.push(Prisma.sql`${haystack} like ${like(word)}`);
  }
  const code = text(filter.code, "Codigo");
  if (code) conditions.push(Prisma.sql`${column(Prisma.sql`l.codigo`)} like ${like(code)}`);
  const title = text(filter.title, "Titulo");
  if (title) conditions.push(Prisma.sql`${column(Prisma.sql`l.titulo`)} like ${like(title)}`);
  return Prisma.join(conditions, " and ");
}

export type BookRow = { sync_uid: string; codigo: string; titulo: string; autor: string | null; preco: bigint;
  categoria: number; descricao: string | null; ativo: boolean; capaUid: string | null; saldo: bigint };

export function bookListQuery(filter: BookListFilter, limit: number) {
  return Prisma.sql`select l.sync_uid::text, l.codigo, l.titulo, l.autor, l.preco_centavos as preco, l.categoria,
      l.descricao, l.ativo, l.capa_uid::text as "capaUid",
      coalesce((select sum(m.qtd) from public.movimento_estoque m
        where m.livro_uid=l.sync_uid and m.excluido_em is null),0)::bigint as saldo
    from public.livro l where ${bookListWhere(filter)} order by l.sync_uid limit ${limit + 1}`;
}

function safe(value: bigint, label: string) {
  if (value < BigInt(Number.MIN_SAFE_INTEGER) || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new ConflictException(`${label} fora do contrato; reconciliacao necessaria`);
  }
  return Number(value);
}

export function bookListItem(row: BookRow, summary: boolean) {
  if (row.preco < 0n) throw new ConflictException("Preco legado fora do contrato; reconciliacao necessaria");
  return { sync_uid: row.sync_uid, codigo: row.codigo, titulo: row.titulo, autor: row.autor,
    preco_centavos: safe(row.preco, "Preco"), categoria: row.categoria,
    ...(!summary && { descricao: row.descricao }), ativo: row.ativo, capaUid: row.capaUid,
    saldo: safe(row.saldo, "Saldo") };
}

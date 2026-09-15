import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { objectInput, textInput } from "./reference-input";

type Profile = "admin" | "operador";

function login(value: unknown) {
  const result = textInput(value, 100, true)!.toLowerCase();
  if (!/^[a-z0-9._-]+$/.test(result)) throw new BadRequestException("Usuario invalido");
  return result;
}

function profile(value: unknown): Profile {
  if (value !== "admin" && value !== "operador") throw new BadRequestException("Perfil invalido");
  return value;
}

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async list() {
    return this.db.usuario.findMany({ orderBy: { usuario: "asc" },
      select: { sync_uid: true, usuario: true, nome: true, perfil: true, ativo: true, excluido_em: true } });
  }

  async create(value: unknown, actor: string) {
    const input = objectInput(value);
    const usuario = login(input.usuario);
    const nome = textInput(input.nome, 500);
    const perfil = profile(input.perfil);
    const senha = textInput(input.senha, 200, true)!;
    if (senha.length < 4) throw new BadRequestException("Senha muito curta");
    try {
      const rows = await this.db.$queryRaw<{ sync_uid: string }[]>`
        insert into public.usuario(sync_uid,usuario,nome,senha_hash,perfil,origem,
          criado_por,atualizado_em,sincronizado_em)
        values(gen_random_uuid(),${usuario},${nome},crypt(${senha},gen_salt('bf')),${perfil},
          'nuvem',${actor}::uuid,now(),now()) returning sync_uid::text`;
      return rows[0];
    } catch (error) {
      const prisma = error as { code?: string; meta?: { code?: string } };
      if (prisma.code === "P2010" && prisma.meta?.code === "23505") {
        throw new ConflictException("Usuario ja existe");
      }
      throw error;
    }
  }

  async update(id: string, value: unknown) {
    const usuario = login(id);
    const input = objectInput(value);
    const perfil = profile(input.perfil);
    const nome = textInput(input.nome, 500);
    return this.db.$transaction(async tx => {
      await tx.$executeRaw`lock table public.usuario in share row exclusive mode`;
      const current = await tx.usuario.findUnique({ where: { usuario } });
      if (!current) throw new NotFoundException();
      if (current.perfil === "admin" && !current.excluido_em && perfil !== "admin") {
        const admins = await tx.usuario.count({ where: { perfil: "admin", excluido_em: null, ativo: true } });
        if (admins <= 1) throw new ConflictException("Precisa existir ao menos um admin ativo");
      }
      const now = new Date();
      await tx.usuario.update({ where: { usuario }, data: { nome, perfil,
        atualizado_em: now, sincronizado_em: now, origem: "nuvem" } });
      return { atualizado: true };
    });
  }

  async password(id: string, value: unknown) {
    const usuario = login(id);
    const senha = textInput(objectInput(value).senha, 200, true)!;
    if (senha.length < 4) throw new BadRequestException("Senha muito curta");
    const changed = await this.db.$executeRaw`update public.usuario set
      senha_hash=crypt(${senha},gen_salt('bf')),atualizado_em=now(),sincronizado_em=now(),origem='nuvem'
      where usuario=${usuario}`;
    if (!changed) throw new NotFoundException();
    return { atualizado: true };
  }

  async active(id: string, value: unknown) {
    const usuario = login(id);
    const ativa = objectInput(value).ativa;
    if (typeof ativa !== "boolean") throw new BadRequestException();
    return this.db.$transaction(async tx => {
      await tx.$executeRaw`lock table public.usuario in share row exclusive mode`;
      const current = await tx.usuario.findUnique({ where: { usuario } });
      if (!current) throw new NotFoundException();
      if (!ativa && current.perfil === "admin" && !current.excluido_em) {
        const admins = await tx.usuario.count({ where: { perfil: "admin", excluido_em: null, ativo: true } });
        if (admins <= 1) throw new ConflictException("Precisa existir ao menos um admin ativo");
      }
      const now = new Date();
      await tx.usuario.update({ where: { usuario }, data: { ativo: ativa,
        excluido_em: ativa ? null : now, atualizado_em: now, sincronizado_em: now, origem: "nuvem" } });
      return { atualizado: true };
    });
  }
}

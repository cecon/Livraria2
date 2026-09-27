import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { PrismaService } from "../database/prisma.service";
import { uuid } from "../sync/validation";

@Injectable()
export class ImagesService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  async upload(value: unknown, actor: string) {
    if (typeof value !== "string" || value.length > 7_000_000) throw new BadRequestException("Imagem muito grande. Limite: 5 MB.");
    const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
    if (!match) throw new BadRequestException("Escolha uma imagem JPEG, PNG ou WebP.");
    const input = Buffer.from(match[2], "base64");
    if (!input.length || input.length > 5 * 1024 * 1024) throw new BadRequestException("Imagem muito grande. Limite: 5 MB.");
    let bytes: Buffer;
    try {
      const source = sharp(input, { limitInputPixels: 25_000_000, failOn: "warning" });
      const meta = await source.metadata();
      if (!["jpeg", "png", "webp"].includes(meta.format ?? "") || (meta.pages ?? 1) !== 1) throw new Error();
      bytes = await source.rotate().resize({ width: 1000, height: 1000, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
      if (bytes.length > 512_000) throw new Error();
    } catch { throw new BadRequestException("Imagem inválida ou excessiva. Use JPEG, PNG ou WebP estático, até 25 megapixels."); }
    const hash = createHash("sha256").update(bytes).digest("hex");
    const rows = await this.db.$queryRaw<{ uid: string }[]>`
      insert into public.livro_capa_arquivo(uid,conteudo,criado_por,content_type,sha256)
      values(${randomUUID()}::uuid,${bytes},${actor}::uuid,'image/webp',${hash})
      on conflict(sha256) do update set sha256=excluded.sha256 returning uid::text`;
    return { uid: rows[0].uid, url: `/api/capas/${rows[0].uid}` };
  }
  async read(id: string) {
    const rows = await this.db.$queryRaw<{ conteudo: Buffer; content_type: string | null }[]>`
      select conteudo,content_type from public.livro_capa_arquivo where uid=${uuid(id)}::uuid`;
    if (!rows[0]) throw new NotFoundException("Imagem indisponível.");
    if (rows[0].content_type === "image/webp") return rows[0].conteudo;
    // Arquivos anteriores à normalização permanecem preservados no banco.
    try {
      const bytes = await sharp(rows[0].conteudo, { limitInputPixels: 25_000_000 }).rotate()
        .resize({ width: 1000, height: 1000, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
      if (bytes.length > 512_000) throw new Error();
      return bytes;
    }
    catch { throw new NotFoundException("Imagem antiga indisponível."); }
  }
}

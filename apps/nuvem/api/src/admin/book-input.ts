import { BadRequestException } from "@nestjs/common";

export function bookInput(value: unknown, creating: boolean) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BadRequestException();
  const input = value as Record<string, unknown>;
  const text = (key: string, max: number, required = false) => {
    if (typeof input[key] !== "string" || (input[key] as string).length > max) {
      throw new BadRequestException(`Campo invalido: ${key}`);
    }
    const result = (input[key] as string).trim();
    if (required && !result) throw new BadRequestException(`Campo obrigatorio: ${key}`);
    return result;
  };
  const codigo = text("codigo", 100, true);
  const titulo = text("titulo", 500, true);
  const autor = text("autor", 500);
  const descricao = text("descricao", 5000);
  const cents = input.preco_centavos;
  const category = input.categoria;
  const initial = input.estoqueInicial ?? 0;
  if (!Number.isSafeInteger(cents) || (cents as number) < 0 ||
      !Number.isInteger(category) || (category as number) < 0 || (category as number) > 6 ||
      !Number.isSafeInteger(initial) || (initial as number) < 0 || (!creating && initial !== 0)) {
    throw new BadRequestException("Preco, categoria ou estoque inicial invalido");
  }
  const buscaNorm = `${titulo} ${autor} ${codigo}`.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return { codigo, titulo, autor: autor || null, descricao: descricao || null,
    precoCentavos: BigInt(cents as number), categoria: category as number,
    buscaNorm, initial: BigInt(initial as number) };
}

export type LivroEstoqueRaw = {
  sync_uid: string;
  codigo: string;
  titulo: string;
  categoria: number;
  preco_centavos: number;
};

export type ItemRelatorioEstoque = {
  codigo: string;
  titulo: string;
  categoria: number;
  precoCentavos: number;
  estoque: number;
  valorCentavos: number;
};

export function montarItensRelatorioEstoque(
  livros: LivroEstoqueRaw[],
  saldos: Map<string, number>,
): ItemRelatorioEstoque[] {
  return livros
    .map((livro) => {
      const estoque = saldos.get(livro.sync_uid) ?? 0;
      return {
        codigo: livro.codigo,
        titulo: livro.titulo,
        categoria: livro.categoria,
        precoCentavos: Number(livro.preco_centavos),
        estoque,
        valorCentavos: estoque * Number(livro.preco_centavos),
      };
    })
    .sort((a, b) => a.titulo.localeCompare(b.titulo));
}

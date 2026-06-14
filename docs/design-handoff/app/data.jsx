// ── Espaço do Livro — domain data ─────────────────────────────────────────────
// Categorias (numeric ids, matching legacy "Categoria (0 = Não Categorizado)")
const CATEGORIAS = {
  0: "Não Categorizado",
  1: "Bíblias",
  2: "Infantil",
  3: "Família",
  4: "Devocional",
  5: "Estudo & Teologia",
  6: "Ficção",
};

// Real titles pulled from the legacy report screens + plausible catalog padding.
const BOOKS = [
  { codigo: "9786556555256", titulo: "Bíblia Sagrada Cinza",            autor: "Sociedade Bíblica do Brasil", preco: 30.0, categoria: 1, estoque: 14, descricao: "Bíblia Sagrada, capa cinza, letra média, leitura confortável." },
  { codigo: "9786587533902", titulo: "Aprenda a Bíblia com 3 Palavrinhas", autor: "Jonty Allcock",            preco: 29.0, categoria: 2, estoque: 9,  descricao: "Livro infantil ilustrado para introduzir as Escrituras." },
  { codigo: "9786587533490", titulo: "Jogo da Bíblia",                  autor: "Editora Cristã",              preco: 29.0, categoria: 2, estoque: 6,  descricao: "Jogo de tabuleiro com perguntas e desafios bíblicos." },
  { codigo: "9786559884001", titulo: "Você Me Entende",                 autor: "Sarah Mackenzie",             preco: 15.0, categoria: 3, estoque: 22, descricao: "Reflexões sobre relacionamentos e empatia." },
  { codigo: "9786559884209", titulo: "Tempo em Família",                autor: "Paul Tripp",                  preco: 20.0, categoria: 3, estoque: 3,  descricao: "Devocional para momentos em família." },
  { codigo: "7899938431009", titulo: "100 Passos Bíblia da Família",    autor: "Equipe Pão Diário",           preco: 45.0, categoria: 3, estoque: 11, descricao: "Bíblia ilustrada para devoções familiares." },
  { codigo: "9786559884827", titulo: "Quando o Verão Me Trouxe Flores", autor: "Ana Lúcia",                   preco: 48.0, categoria: 6, estoque: 7,  descricao: "Romance leve sobre recomeços e esperança." },
  { codigo: "9788577424405", titulo: "Seus Passos — O Que Faria Jesus", autor: "Charles Sheldon",             preco: 35.0, categoria: 4, estoque: 2,  descricao: "Clássico que inspirou o movimento 'O que Jesus faria?'." },
  { codigo: "9786586497021", titulo: "O Peregrino",                     autor: "John Bunyan",                 preco: 39.9, categoria: 6, estoque: 18, descricao: "Alegoria clássica da jornada cristã." },
  { codigo: "9788543303451", titulo: "A Cruz e o Punhal",              autor: "David Wilkerson",             preco: 32.5, categoria: 4, estoque: 5,  descricao: "Relato missionário nas ruas de Nova York." },
  { codigo: "9788578601020", titulo: "Institutas da Religião Cristã",   autor: "João Calvino",                preco: 89.0, categoria: 5, estoque: 4,  descricao: "Obra fundamental da teologia reformada." },
  { codigo: "9786555610017", titulo: "O Conhecimento do Santo",        autor: "A. W. Tozer",                 preco: 28.0, categoria: 4, estoque: 1,  descricao: "Sobre os atributos de Deus." },
  { codigo: "9788580380019", titulo: "Cartas de um Diabo a seu Aprendiz", autor: "C. S. Lewis",              preco: 34.9, categoria: 6, estoque: 13, descricao: "Sátira espiritual em forma de cartas." },
  { codigo: "9786586144772", titulo: "Devocional Diário — 365 Dias",    autor: "Vários Autores",              preco: 42.0, categoria: 4, estoque: 0,  descricao: "Um devocional para cada dia do ano." },
  { codigo: "9788534505031", titulo: "Bíblia de Estudo da Mulher",      autor: "Editora Vida",                preco: 119.9, categoria: 1, estoque: 8, descricao: "Bíblia de estudo com notas temáticas." },
  { codigo: "9786559880010", titulo: "Pequenos Heróis da Fé",          autor: "Marília Batista",             preco: 24.5, categoria: 2, estoque: 16, descricao: "Histórias bíblicas para crianças." },
];

// Mock vendas for "today" (used by the Relatório). Matches the legacy report numbers.
const PEDIDOS_HOJE = [
  { numero: 5993, cliente: "CLIENTE", turno: "manha", itens: [
      { codigo: "9786556555256", titulo: "Bíblia Sagrada Cinza", qtd: 1, preco: 30.0 } ],
    pag: { cartao: 30, pix: 0, dinheiro: 0, ministerio: 0, vale: 0 } },
  { numero: 5994, cliente: "CLIENTE", turno: "manha", itens: [
      { codigo: "9786587533902", titulo: "Aprenda a Bíblia com 3 Palavrinhas", qtd: 1, preco: 29.0 },
      { codigo: "9786587533490", titulo: "Jogo da Bíblia", qtd: 1, preco: 29.0 },
      { codigo: "9786559884001", titulo: "Você Me Entende", qtd: 1, preco: 15.0 },
      { codigo: "9786559884209", titulo: "Tempo em Família", qtd: 1, preco: 20.0 },
      { codigo: "7899938431009", titulo: "100 Passos Bíblia da Família", qtd: 1, preco: 45.0 } ],
    pag: { cartao: 138, pix: 0, dinheiro: 0, ministerio: 0, vale: 0 } },
  { numero: 5995, cliente: "CLIENTE", turno: "tarde", itens: [
      { codigo: "9786559884827", titulo: "Quando o Verão Me Trouxe Flores", qtd: 1, preco: 48.0 } ],
    pag: { cartao: 0, pix: 48.02, dinheiro: 0, ministerio: 0, vale: 0 } },
];

const PAGAMENTOS = [
  { key: "cartao",     label: "Cartão" },
  { key: "dinheiro",   label: "Dinheiro" },
  { key: "pix",        label: "PIX" },
  { key: "ministerio", label: "Ministério" },
  { key: "vale",       label: "Vale Presente" },
];

const BRL = (n) => "R$ " + (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// accent- & case-insensitive normaliser for search
const norm = (s) => (s == null ? "" : s.toString()).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

Object.assign(window, { CATEGORIAS, BOOKS, PEDIDOS_HOJE, PAGAMENTOS, BRL, norm });

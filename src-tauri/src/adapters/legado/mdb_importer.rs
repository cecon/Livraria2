//! Importador do legado Access via `mdb-export` (mdbtools), parse CSV (ADR-0006).

use super::mapeamentos::{data_iso, double_para_i64, turma_para_turno, valor_para_centavos};
use crate::application::ports::{ImportadorLegado, PedidosImportados, RepoErro};
use crate::domain::categoria::Categoria;
use crate::domain::dinheiro::Dinheiro;
use crate::domain::livro::Livro;
use crate::domain::pagamento::FormaPagamento;
use crate::domain::pedido::{ItemPedido, Pagamentos, Pedido};
use csv::StringRecord;
use std::collections::{BTreeMap, HashMap};

pub struct MdbImportador {
    caminho: String,
}

impl MdbImportador {
    pub fn new(caminho: impl Into<String>) -> Self {
        Self {
            caminho: caminho.into(),
        }
    }

    fn exportar(&self, tabela: &str) -> Result<Vec<u8>, RepoErro> {
        let saida = std::process::Command::new("mdb-export")
            .arg(&self.caminho)
            .arg(tabela)
            .output()
            .map_err(|e| RepoErro::Persistencia(format!("mdb-export indisponível: {e}")))?;
        if !saida.status.success() {
            return Err(RepoErro::Persistencia(format!(
                "mdb-export {tabela}: {}",
                String::from_utf8_lossy(&saida.stderr)
            )));
        }
        Ok(saida.stdout)
    }

    fn ler(&self, tabela: &str) -> Result<(HashMap<String, usize>, Vec<StringRecord>), RepoErro> {
        let bytes = self.exportar(tabela)?;
        let mut rdr = csv::ReaderBuilder::new()
            .has_headers(true)
            .flexible(true)
            .from_reader(&bytes[..]);
        let idx = rdr
            .headers()
            .map_err(csverr)?
            .iter()
            .enumerate()
            .map(|(i, h)| (h.to_string(), i))
            .collect();
        let mut linhas = Vec::new();
        for rec in rdr.records() {
            linhas.push(rec.map_err(csverr)?);
        }
        Ok((idx, linhas))
    }
}

fn csverr(e: csv::Error) -> RepoErro {
    RepoErro::Persistencia(format!("CSV do legado: {e}"))
}

fn campo<'a>(rec: &'a StringRecord, idx: &HashMap<String, usize>, nome: &str) -> &'a str {
    idx.get(nome).and_then(|i| rec.get(*i)).unwrap_or("")
}

fn opt(s: &str) -> Option<String> {
    let t = s.trim();
    if t.is_empty() {
        None
    } else {
        Some(t.to_string())
    }
}

fn eh_resumo(rec: &StringRecord, idx: &HashMap<String, usize>) -> bool {
    campo(rec, idx, "vdtitulo")
        .trim_start()
        .starts_with("Total do Pedido")
}

fn acumular(acc: &mut [i64; 5], forma: FormaPagamento, valor: i64) {
    let i = match forma {
        FormaPagamento::Cartao => 0,
        FormaPagamento::Dinheiro => 1,
        FormaPagamento::Pix => 2,
        FormaPagamento::Ministerio => 3,
        FormaPagamento::ValePresente => 4,
    };
    acc[i] += valor;
}

impl ImportadorLegado for MdbImportador {
    fn livros(&self) -> Result<Vec<Livro>, RepoErro> {
        let (idx, linhas) = self.ler("cadastro")?;
        let mut livros = Vec::new();
        for r in &linhas {
            let codigo = campo(r, &idx, "cdbar").trim().to_string();
            if codigo.is_empty() {
                continue; // sem código de barras válido — descartado (data-model)
            }
            livros.push(Livro {
                codigo,
                titulo: campo(r, &idx, "cdtitulo").trim().to_string(),
                autor: opt(campo(r, &idx, "cdautor")),
                preco: Dinheiro::de_centavos(valor_para_centavos(campo(r, &idx, "cdvalor"))),
                categoria: Categoria::de_legado(campo(r, &idx, "cdcategoria")),
                estoque: double_para_i64(campo(r, &idx, "cdestoque")),
                descricao: opt(campo(r, &idx, "cddescricao")),
            });
        }
        Ok(livros)
    }

    fn pedidos(&self) -> Result<PedidosImportados, RepoErro> {
        let (idx, linhas) = self.ler("venda")?;
        let mut grupos: BTreeMap<i64, Vec<&StringRecord>> = BTreeMap::new();
        for r in &linhas {
            if let Ok(n) = campo(r, &idx, "vdpedido").trim().parse::<i64>() {
                grupos.entry(n).or_default().push(r);
            }
        }

        let mut pedidos = Vec::new();
        let mut divergencias = Vec::new();
        for (numero, grp) in grupos {
            let resumo = grp.iter().find(|r| eh_resumo(r, &idx)).copied();
            let fonte = resumo.or_else(|| grp.first().copied()).unwrap();

            let mut itens = Vec::new();
            let mut acc = [0i64; 5];
            for r in &grp {
                if campo(r, &idx, "vdbar").trim().is_empty() || eh_resumo(r, &idx) {
                    continue;
                }
                let qtd = campo(r, &idx, "vdquanto").trim().parse::<i64>().unwrap_or(1).max(1);
                let preco = valor_para_centavos(campo(r, &idx, "vdvalor"));
                let forma = FormaPagamento::de_legado_metodo(campo(r, &idx, "vdmetodo"));
                acumular(&mut acc, forma, preco * qtd);
                itens.push(ItemPedido {
                    codigo: campo(r, &idx, "vdbar").trim().to_string(),
                    titulo: campo(r, &idx, "vdtitulo").trim().to_string(),
                    preco: Dinheiro::de_centavos(preco),
                    qtd,
                });
            }
            if itens.is_empty() {
                divergencias.push(format!("Pedido {numero}: sem itens reconstruíveis"));
                continue;
            }

            // Pagamentos: a fonte real são as colunas de valor da linha-resumo
            // (vdcartao/vdpix/...). Só caímos no split derivado de `vdmetodo` quando
            // o resumo não tem valores (dados antigos) — FR-067a.
            let pag_resumo = resumo.map(|res| Pagamentos {
                cartao: Dinheiro::de_centavos(valor_para_centavos(campo(res, &idx, "vdcartao"))),
                dinheiro: Dinheiro::de_centavos(valor_para_centavos(campo(res, &idx, "vddinheiro"))),
                pix: Dinheiro::de_centavos(valor_para_centavos(campo(res, &idx, "vdpix"))),
                ministerio: Dinheiro::de_centavos(valor_para_centavos(campo(res, &idx, "vdministerio"))),
                vale: Dinheiro::de_centavos(valor_para_centavos(campo(res, &idx, "vdvale"))),
            });
            let mut pagamentos = match pag_resumo {
                Some(p) if p.pago().centavos() > 0 => p,
                _ => Pagamentos {
                    cartao: Dinheiro::de_centavos(acc[0]),
                    dinheiro: Dinheiro::de_centavos(acc[1]),
                    pix: Dinheiro::de_centavos(acc[2]),
                    ministerio: Dinheiro::de_centavos(acc[3]),
                    vale: Dinheiro::de_centavos(acc[4]),
                },
            };

            // Marcador de repasse: a livraria soma alguns centavos no PIX para o
            // financeiro identificar o lançamento. Ao importar, removemos esse
            // excedente pequeno (≤5c) do PIX para o pagamento bater com o total.
            let item_total: i64 = itens.iter().map(|i| i.preco.centavos() * i.qtd).sum();
            let excedente = pagamentos.pago().centavos() - item_total;
            if pagamentos.pix.centavos() > 0 && (1..=5).contains(&excedente) {
                pagamentos.pix = Dinheiro::de_centavos(pagamentos.pix.centavos() - excedente);
            }

            let nome = campo(fonte, &idx, "vdnome").trim();
            let pedido = Pedido {
                numero,
                cliente: if nome.is_empty() { "CLIENTE".into() } else { nome.into() },
                turno: turma_para_turno(campo(fonte, &idx, "vdturma")),
                data: data_iso(campo(fonte, &idx, "vddata")),
                itens,
                pagamentos,
            };

            if let Some(res) = resumo {
                let total_resumo = valor_para_centavos(campo(res, &idx, "vdtotal"));
                if total_resumo != pedido.total().centavos() {
                    divergencias.push(format!(
                        "Pedido {numero}: itens somam {} mas resumo diz {}",
                        pedido.total().centavos(),
                        total_resumo
                    ));
                }
            }
            pedidos.push(pedido);
        }
        Ok(PedidosImportados {
            pedidos,
            divergencias,
        })
    }
}

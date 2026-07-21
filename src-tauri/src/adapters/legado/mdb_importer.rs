//! Importador do legado Access via `mdb-export` (mdbtools), parse CSV (ADR-0006).

use super::mapeamentos::{data_iso, double_para_i64, turma_para_turno, valor_para_centavos};
use crate::application::ports::{ImportadorLegado, PedidosImportados, RepoErro};
use crate::domain::categoria::Categoria;
use crate::domain::dinheiro::Dinheiro;
use crate::domain::livro::Livro;
use crate::domain::pagamento::{ChaveSistema, FormaIds};
use crate::domain::pedido::{pago, ItemPedido, Pagamentos, Pedido, Recebimento};
use crate::domain::texto::caixa_alta_sem_acento;
use csv::StringRecord;
use std::collections::{BTreeMap, HashMap};

/// Lê uma tabela do Access via ADODB/ACE OLEDB e imprime CSV UTF-8.
/// Cultura invariante para os decimais saírem com ponto (igual ao mdb-export).
#[cfg(target_os = "windows")]
const PS_LER_ACCESS: &str = r#"
$ErrorActionPreference = 'Stop'
[System.Threading.Thread]::CurrentThread.CurrentCulture = [System.Globalization.CultureInfo]::InvariantCulture
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$path = $env:MDB_PATH; $table = $env:MDB_TABLE
$conn = New-Object -ComObject ADODB.Connection
$opened = $false
foreach ($p in @('Microsoft.ACE.OLEDB.12.0','Microsoft.ACE.OLEDB.16.0')) {
  try { $conn.Open("Provider=$p;Data Source=$path;"); $opened = $true; break } catch {}
}
if (-not $opened) { throw 'Provedor ACE OLEDB nao encontrado (instale o Access/Office 64 bits)' }
$rs = New-Object -ComObject ADODB.Recordset
$rs.Open("SELECT * FROM [$table]", $conn)
$sb = New-Object System.Text.StringBuilder
$n = $rs.Fields.Count
$h = for ($i=0; $i -lt $n; $i++) { '"' + (($rs.Fields.Item($i).Name) -replace '"','""') + '"' }
[void]$sb.AppendLine($h -join ',')
while (-not $rs.EOF) {
  $row = for ($i=0; $i -lt $n; $i++) {
    $v = $rs.Fields.Item($i).Value
    if ($null -eq $v) { '""' } else { '"' + (([string]$v) -replace '"','""') + '"' }
  }
  [void]$sb.AppendLine($row -join ',')
  $rs.MoveNext()
}
$rs.Close(); $conn.Close()
[Console]::Out.Write($sb.ToString())
"#;

pub struct MdbImportador {
    caminho: String,
}

impl MdbImportador {
    pub fn new(caminho: impl Into<String>) -> Self {
        Self {
            caminho: caminho.into(),
        }
    }

    /// Exporta uma tabela do Access como CSV (bytes UTF-8).
    /// Windows: usa o motor do Office (ACE OLEDB) já instalado na máquina.
    /// macOS/Linux: usa o mdbtools (mdb-export).
    fn exportar(&self, tabela: &str) -> Result<Vec<u8>, RepoErro> {
        #[cfg(target_os = "windows")]
        return self.exportar_ace(tabela);
        #[cfg(not(target_os = "windows"))]
        return self.exportar_mdbtools(tabela);
    }

    #[cfg(not(target_os = "windows"))]
    fn exportar_mdbtools(&self, tabela: &str) -> Result<Vec<u8>, RepoErro> {
        let saida = std::process::Command::new("mdb-export")
            .arg(&self.caminho)
            .arg(tabela)
            .output()
            .map_err(|e| {
                RepoErro::Persistencia(format!(
                    "mdbtools (mdb-export) não está instalado nesta máquina. ({e})"
                ))
            })?;
        if !saida.status.success() {
            return Err(RepoErro::Persistencia(format!(
                "mdb-export {tabela}: {}",
                String::from_utf8_lossy(&saida.stderr)
            )));
        }
        Ok(saida.stdout)
    }

    #[cfg(target_os = "windows")]
    fn exportar_ace(&self, tabela: &str) -> Result<Vec<u8>, RepoErro> {
        let saida = std::process::Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", PS_LER_ACCESS])
            .env("MDB_PATH", &self.caminho)
            .env("MDB_TABLE", tabela)
            .output()
            .map_err(|e| RepoErro::Persistencia(format!("PowerShell indisponível: {e}")))?;
        if !saida.status.success() {
            return Err(RepoErro::Persistencia(format!(
                "Não consegui ler o Access via o motor do Office (ACE) nesta máquina. \
                 Verifique se o Access/Office (64 bits) está instalado. Detalhe: {}",
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

/// Ordem fixa do acumulador: credito, dinheiro, pix, ministerio, vale.
fn acumular(acc: &mut [i64; 5], chave: ChaveSistema, valor: i64) {
    let i = match chave {
        ChaveSistema::Credito => 0,
        ChaveSistema::Dinheiro => 1,
        ChaveSistema::Pix => 2,
        ChaveSistema::Ministerio => 3,
        ChaveSistema::Vale => 4,
    };
    acc[i] += valor;
}

/// Monta a lista esparsa de recebimentos (só valor > 0), resolvendo chave → id.
fn montar_pagamentos(acc: [i64; 5], formas: &FormaIds) -> Pagamentos {
    let chaves = [
        ChaveSistema::Credito,
        ChaveSistema::Dinheiro,
        ChaveSistema::Pix,
        ChaveSistema::Ministerio,
        ChaveSistema::Vale,
    ];
    chaves
        .into_iter()
        .zip(acc)
        .filter(|(_, v)| *v > 0)
        .map(|(chave, v)| Recebimento {
            forma_id: formas.id_de(chave),
            valor: Dinheiro::de_centavos(v),
        })
        .collect()
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
                titulo: caixa_alta_sem_acento(campo(r, &idx, "cdtitulo")),
                autor: opt(campo(r, &idx, "cdautor")).map(|a| caixa_alta_sem_acento(&a)),
                preco: Dinheiro::de_centavos(valor_para_centavos(campo(r, &idx, "cdvalor"))),
                categoria: Categoria::de_legado(campo(r, &idx, "cdcategoria")),
                estoque: double_para_i64(campo(r, &idx, "cdestoque")),
                descricao: opt(campo(r, &idx, "cddescricao")),
                // legado não tem custo; o `codigo` (cdbar) é o próprio código de barras
                custo_medio: Dinheiro::ZERO,
            });
        }
        Ok(livros)
    }

    fn pedidos(&self, formas: &FormaIds) -> Result<PedidosImportados, RepoErro> {
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
                let chave = ChaveSistema::de_legado_metodo(campo(r, &idx, "vdmetodo"));
                acumular(&mut acc, chave, preco * qtd);
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
            // (vdcartao/vdpix/...), mapeadas por CHAVE estável (FR-018 — o cartão de
            // crédito do legado cai em `credito`). Só caímos no split derivado de
            // `vdmetodo` quando o resumo não tem valores (dados antigos) — FR-067a.
            let acc_resumo = resumo.map(|res| {
                [
                    valor_para_centavos(campo(res, &idx, "vdcartao")),
                    valor_para_centavos(campo(res, &idx, "vddinheiro")),
                    valor_para_centavos(campo(res, &idx, "vdpix")),
                    valor_para_centavos(campo(res, &idx, "vdministerio")),
                    valor_para_centavos(campo(res, &idx, "vdvale")),
                ]
            });
            let mut pagamentos = match acc_resumo {
                Some(a) if a.iter().sum::<i64>() > 0 => montar_pagamentos(a, formas),
                _ => montar_pagamentos(acc, formas),
            };

            // Marcador de repasse: a livraria soma alguns centavos no PIX para o
            // financeiro identificar o lançamento. Ao importar, removemos esse
            // excedente pequeno (≤5c) do PIX para o pagamento bater com o total.
            let item_total: i64 = itens.iter().map(|i| i.preco.centavos() * i.qtd).sum();
            let excedente = pago(&pagamentos).centavos() - item_total;
            if (1..=5).contains(&excedente) {
                if let Some(r) = pagamentos
                    .iter_mut()
                    .find(|r| r.forma_id == formas.pix && r.valor.centavos() > excedente)
                {
                    r.valor = Dinheiro::de_centavos(r.valor.centavos() - excedente);
                }
            }

            let nome = campo(fonte, &idx, "vdnome").trim();
            let pedido = Pedido {
                numero,
                cliente: if nome.is_empty() { "CLIENTE".into() } else { nome.into() },
                turno: turma_para_turno(campo(fonte, &idx, "vdturma")),
                data: data_iso(campo(fonte, &idx, "vddata")),
                itens,
                pagamentos,
                operador: None, // vendas do legado não têm operador
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

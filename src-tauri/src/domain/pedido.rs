//! Modelo de domínio do Pedido: itens, recebimentos por forma e cálculos ao vivo.
//!
//! Pagamentos são uma lista de recebimentos vinculados ao cadastro de formas por
//! `forma_id` opaco (ADR-0013). O troco é amarrado à forma Dinheiro, resolvida pela
//! aplicação via chave estável — o domínio não conhece rótulos nem banco.

use super::dinheiro::Dinheiro;
use super::erros::ErroDominio;
use super::pagamento::Turno;

#[derive(Debug, Clone, PartialEq)]
pub struct ItemPedido {
    pub codigo: String,
    pub titulo: String,  // snapshot (FR-016)
    pub preco: Dinheiro, // snapshot (FR-016)
    pub qtd: i64,
}

impl ItemPedido {
    pub fn total(&self) -> Dinheiro {
        Dinheiro::de_centavos(self.preco.centavos() * self.qtd)
    }
}

/// Adiciona um item ao carrinho, somando a quantidade se o código já existe (FR-011).
/// Quantidade resultante nunca fica abaixo de 1.
pub fn somar_item(itens: &mut Vec<ItemPedido>, novo: ItemPedido) -> Result<(), ErroDominio> {
    if novo.qtd < 1 {
        return Err(ErroDominio::QuantidadeInvalida);
    }
    if let Some(existente) = itens.iter_mut().find(|i| i.codigo == novo.codigo) {
        existente.qtd += novo.qtd;
    } else {
        itens.push(novo);
    }
    Ok(())
}

/// Valor recebido em uma forma de pagamento do cadastro (FR-014).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Recebimento {
    pub forma_id: i64,
    pub valor: Dinheiro,
}

/// Recebimentos da venda: lista esparsa (só formas com valor). Substitui a struct
/// de campos fixos — comporta formas criadas pelo usuário (FR-005/FR-012).
pub type Pagamentos = Vec<Recebimento>;

/// Soma de todas as formas (FR-012).
pub fn pago(pagamentos: &Pagamentos) -> Dinheiro {
    pagamentos
        .iter()
        .fold(Dinheiro::ZERO, |acc, r| acc.soma(r.valor))
}

/// Valor recebido numa forma específica (0 se ausente).
pub fn por_forma_id(pagamentos: &Pagamentos, forma_id: i64) -> Dinheiro {
    pagamentos
        .iter()
        .filter(|r| r.forma_id == forma_id)
        .fold(Dinheiro::ZERO, |acc, r| acc.soma(r.valor))
}

/// Janela de cancelamento de venda em dias corridos (FR-011 da 006).
pub const JANELA_CANCELAMENTO_DIAS: i64 = 5;

/// Dias corridos desde a época civil (algoritmo days-from-civil, sem dependência).
fn dias_civis(data_iso: &str) -> Option<i64> {
    let mut partes = data_iso.splitn(3, '-');
    let ano: i64 = partes.next()?.parse().ok()?;
    let mes: i64 = partes.next()?.parse().ok()?;
    let dia: i64 = partes.next()?.get(..2).unwrap_or_default().parse().ok()?;
    if !(1..=12).contains(&mes) || !(1..=31).contains(&dia) {
        return None;
    }
    let a = ano - i64::from(mes <= 2);
    let era = a.div_euclid(400);
    let aoe = a - era * 400;
    let doy = (153 * (if mes > 2 { mes - 3 } else { mes + 9 }) + 2) / 5 + dia - 1;
    let doe = aoe * 365 + aoe / 4 - aoe / 100 + doy;
    Some(era * 146_097 + doe)
}

/// Cancelamento permitido até `JANELA_CANCELAMENTO_DIAS` dias corridos da venda
/// (FR-011). Datas ISO `yyyy-mm-dd`; data ilegível → bloqueia (conservador).
pub fn pode_cancelar_venda(data_venda: &str, hoje: &str) -> bool {
    match (dias_civis(data_venda), dias_civis(hoje)) {
        (Some(v), Some(h)) => (h - v) <= JANELA_CANCELAMENTO_DIAS && h >= v,
        _ => false,
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Pedido {
    pub numero: i64,
    pub cliente: String,
    pub turno: Turno,
    pub data: String, // ISO yyyy-mm-dd
    pub itens: Vec<ItemPedido>,
    pub pagamentos: Pagamentos,
    /// Operador que realizou a venda (feature 007, FR-023). `None` = desconhecido.
    pub operador: Option<String>,
}

impl Pedido {
    pub fn total(&self) -> Dinheiro {
        self.itens
            .iter()
            .fold(Dinheiro::ZERO, |acc, i| acc.soma(i.total()))
    }

    /// Quanto ainda falta receber (FR-012).
    pub fn restante(&self) -> Dinheiro {
        self.total().diferenca_piso_zero(pago(&self.pagamentos))
    }

    /// Troco quando o pago excede o total (FR-012).
    pub fn troco(&self) -> Dinheiro {
        pago(&self.pagamentos).diferenca_piso_zero(self.total())
    }

    pub fn total_itens(&self) -> i64 {
        self.itens.iter().map(|i| i.qtd).sum()
    }

    /// Regra de conclusão (FR-013/FR-014): ≥1 item, pago ≥ total e troco só do
    /// Dinheiro — o excedente é válido apenas até o recebido na forma Dinheiro,
    /// identificada pelo `dinheiro_forma_id` resolvido pela aplicação (chave estável).
    pub fn validar_conclusao(&self, dinheiro_forma_id: i64) -> Result<(), ErroDominio> {
        if self.itens.is_empty() {
            return Err(ErroDominio::SemItens);
        }
        let restante = self.restante();
        if restante.centavos() > 0 {
            return Err(ErroDominio::PagoInsuficiente {
                falta_centavos: restante.centavos(),
            });
        }
        let troco = self.troco().centavos();
        if troco > 0 && por_forma_id(&self.pagamentos, dinheiro_forma_id).centavos() < troco {
            return Err(ErroDominio::TrocoSemDinheiro);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const DINHEIRO_ID: i64 = 3;
    const CREDITO_ID: i64 = 1;

    fn item(codigo: &str, preco: i64, qtd: i64) -> ItemPedido {
        ItemPedido {
            codigo: codigo.into(),
            titulo: "Livro".into(),
            preco: Dinheiro::de_centavos(preco),
            qtd,
        }
    }

    fn recebe(forma_id: i64, centavos: i64) -> Recebimento {
        Recebimento {
            forma_id,
            valor: Dinheiro::de_centavos(centavos),
        }
    }

    fn pedido(itens: Vec<ItemPedido>, pagamentos: Pagamentos) -> Pedido {
        Pedido {
            numero: 5997,
            cliente: "CLIENTE".into(),
            turno: Turno::Manha,
            operador: None,
            data: "2026-06-14".into(),
            itens,
            pagamentos,
        }
    }

    #[test]
    fn janela_de_cancelamento_5_dias_corridos() {
        // Dia 5 ainda permite; dia 6 bloqueia (FR-011).
        assert!(pode_cancelar_venda("2026-07-04", "2026-07-04"));
        assert!(pode_cancelar_venda("2026-07-04", "2026-07-09"));
        assert!(!pode_cancelar_venda("2026-07-04", "2026-07-10"));
        // Vira de mês/ano corretamente.
        assert!(pode_cancelar_venda("2026-06-30", "2026-07-05"));
        assert!(!pode_cancelar_venda("2026-06-30", "2026-07-06"));
        assert!(pode_cancelar_venda("2025-12-31", "2026-01-05"));
        // Venda "no futuro" ou data ilegível → bloqueia (conservador).
        assert!(!pode_cancelar_venda("2026-07-10", "2026-07-04"));
        assert!(!pode_cancelar_venda("data-ruim", "2026-07-04"));
    }

    #[test]
    fn soma_quantidade_do_mesmo_codigo() {
        let mut itens = vec![];
        somar_item(&mut itens, item("A", 1000, 1)).unwrap();
        somar_item(&mut itens, item("A", 1000, 2)).unwrap();
        somar_item(&mut itens, item("B", 500, 1)).unwrap();
        assert_eq!(itens.len(), 2);
        assert_eq!(itens[0].qtd, 3);
    }

    #[test]
    fn quantidade_invalida() {
        let mut itens = vec![];
        assert_eq!(
            somar_item(&mut itens, item("A", 1000, 0)),
            Err(ErroDominio::QuantidadeInvalida)
        );
    }

    #[test]
    fn pago_soma_lista_e_por_forma() {
        let pags = vec![recebe(CREDITO_ID, 6000), recebe(DINHEIRO_ID, 4000)];
        assert_eq!(pago(&pags).centavos(), 10000);
        assert_eq!(por_forma_id(&pags, CREDITO_ID).centavos(), 6000);
        assert_eq!(por_forma_id(&pags, 99).centavos(), 0);
    }

    #[test]
    fn totais_restante_troco() {
        let p = pedido(vec![item("A", 3000, 2)], vec![recebe(DINHEIRO_ID, 5000)]);
        assert_eq!(p.total().centavos(), 6000);
        assert_eq!(p.total_itens(), 2);
        assert_eq!(p.restante().centavos(), 1000);
        assert_eq!(p.troco().centavos(), 0);
    }

    #[test]
    fn conclusao_bloqueia_sem_itens_e_pago_insuficiente() {
        let vazio = pedido(vec![], vec![]);
        assert_eq!(
            vazio.validar_conclusao(DINHEIRO_ID),
            Err(ErroDominio::SemItens)
        );

        let faltando = pedido(vec![item("A", 3000, 1)], vec![recebe(CREDITO_ID, 1000)]);
        assert_eq!(
            faltando.validar_conclusao(DINHEIRO_ID),
            Err(ErroDominio::PagoInsuficiente { falta_centavos: 2000 })
        );
    }

    #[test]
    fn conclusao_ok_com_troco_do_dinheiro() {
        let p = pedido(vec![item("A", 3000, 1)], vec![recebe(DINHEIRO_ID, 5000)]);
        assert!(p.validar_conclusao(DINHEIRO_ID).is_ok());
        assert_eq!(p.troco().centavos(), 2000);
    }

    #[test]
    fn conclusao_bloqueia_troco_sem_dinheiro() {
        // Crédito pagou mais que o total, sem dinheiro → troco sem dinheiro: inválido.
        let p = pedido(vec![item("A", 3000, 1)], vec![recebe(CREDITO_ID, 5000)]);
        assert_eq!(
            p.validar_conclusao(DINHEIRO_ID),
            Err(ErroDominio::TrocoSemDinheiro)
        );
    }

    #[test]
    fn troco_misto_valido_ate_o_recebido_em_dinheiro() {
        // Total 3000; crédito 2000 + dinheiro 2000 → troco 1000 ≤ dinheiro (2000): ok.
        let p = pedido(
            vec![item("A", 3000, 1)],
            vec![recebe(CREDITO_ID, 2000), recebe(DINHEIRO_ID, 2000)],
        );
        assert!(p.validar_conclusao(DINHEIRO_ID).is_ok());
        assert_eq!(p.troco().centavos(), 1000);
    }
}

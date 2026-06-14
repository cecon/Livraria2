//! Modelo de domínio do Pedido: itens, pagamentos e cálculos ao vivo (FR-011/012/014).

use super::dinheiro::Dinheiro;
use super::erros::ErroDominio;
use super::pagamento::{FormaPagamento, Turno};

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

/// Valores recebidos por forma de pagamento (apenas registro gerencial).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct Pagamentos {
    pub cartao: Dinheiro,
    pub dinheiro: Dinheiro,
    pub pix: Dinheiro,
    pub ministerio: Dinheiro,
    pub vale: Dinheiro,
}

impl Pagamentos {
    /// Soma de todas as formas (FR-012).
    pub fn pago(&self) -> Dinheiro {
        self.cartao
            .soma(self.dinheiro)
            .soma(self.pix)
            .soma(self.ministerio)
            .soma(self.vale)
    }

    pub fn por_forma(&self, forma: FormaPagamento) -> Dinheiro {
        match forma {
            FormaPagamento::Cartao => self.cartao,
            FormaPagamento::Dinheiro => self.dinheiro,
            FormaPagamento::Pix => self.pix,
            FormaPagamento::Ministerio => self.ministerio,
            FormaPagamento::ValePresente => self.vale,
        }
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
}

impl Pedido {
    pub fn total(&self) -> Dinheiro {
        self.itens
            .iter()
            .fold(Dinheiro::ZERO, |acc, i| acc.soma(i.total()))
    }

    /// Quanto ainda falta receber (FR-012).
    pub fn restante(&self) -> Dinheiro {
        self.total().diferenca_piso_zero(self.pagamentos.pago())
    }

    /// Troco quando o pago excede o total (FR-012).
    pub fn troco(&self) -> Dinheiro {
        self.pagamentos.pago().diferenca_piso_zero(self.total())
    }

    pub fn total_itens(&self) -> i64 {
        self.itens.iter().map(|i| i.qtd).sum()
    }

    /// Regra de conclusão (FR-014): ≥1 item e pago ≥ total.
    pub fn validar_conclusao(&self) -> Result<(), ErroDominio> {
        if self.itens.is_empty() {
            return Err(ErroDominio::SemItens);
        }
        let restante = self.restante();
        if restante.centavos() > 0 {
            return Err(ErroDominio::PagoInsuficiente {
                falta_centavos: restante.centavos(),
            });
        }
        // Troco só pode sair do dinheiro: o excedente não pode vir de cartão/PIX/etc.
        let troco = self.troco().centavos();
        if troco > 0 && self.pagamentos.dinheiro.centavos() < troco {
            return Err(ErroDominio::TrocoSemDinheiro);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(codigo: &str, preco: i64, qtd: i64) -> ItemPedido {
        ItemPedido {
            codigo: codigo.into(),
            titulo: "Livro".into(),
            preco: Dinheiro::de_centavos(preco),
            qtd,
        }
    }

    fn pedido(itens: Vec<ItemPedido>, pagamentos: Pagamentos) -> Pedido {
        Pedido {
            numero: 5997,
            cliente: "CLIENTE".into(),
            turno: Turno::Manha,
            data: "2026-06-14".into(),
            itens,
            pagamentos,
        }
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
    fn totais_restante_troco() {
        let p = pedido(
            vec![item("A", 3000, 2)],
            Pagamentos {
                dinheiro: Dinheiro::de_centavos(5000),
                ..Default::default()
            },
        );
        assert_eq!(p.total().centavos(), 6000);
        assert_eq!(p.total_itens(), 2);
        assert_eq!(p.restante().centavos(), 1000);
        assert_eq!(p.troco().centavos(), 0);
    }

    #[test]
    fn conclusao_bloqueia_sem_itens_e_pago_insuficiente() {
        let vazio = pedido(vec![], Pagamentos::default());
        assert_eq!(vazio.validar_conclusao(), Err(ErroDominio::SemItens));

        let faltando = pedido(
            vec![item("A", 3000, 1)],
            Pagamentos {
                pix: Dinheiro::de_centavos(1000),
                ..Default::default()
            },
        );
        assert_eq!(
            faltando.validar_conclusao(),
            Err(ErroDominio::PagoInsuficiente { falta_centavos: 2000 })
        );
    }

    #[test]
    fn conclusao_ok_com_troco() {
        let p = pedido(
            vec![item("A", 3000, 1)],
            Pagamentos {
                dinheiro: Dinheiro::de_centavos(5000),
                ..Default::default()
            },
        );
        assert!(p.validar_conclusao().is_ok());
        assert_eq!(p.troco().centavos(), 2000);
    }

    #[test]
    fn conclusao_bloqueia_troco_sem_dinheiro() {
        // Cartão pagou mais que o total, sem dinheiro → troco sem dinheiro: inválido.
        let p = pedido(
            vec![item("A", 3000, 1)],
            Pagamentos {
                cartao: Dinheiro::de_centavos(5000),
                ..Default::default()
            },
        );
        assert_eq!(p.validar_conclusao(), Err(ErroDominio::TrocoSemDinheiro));
    }
}

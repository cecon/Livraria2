//! Alocação de saídas entre carimbos e saldo livre (ADR-0014, FR-008).
//! Venda: carimbos na ordem do cadastro (Loja sempre primeira) → saldo livre.
//! (A perda/ajuste é contabilidade oficial e vive na nuvem — feature 012.)

use super::erros::ErroDominio;

/// Quanto saiu de onde. `destinacao_id = None` é o saldo livre (Loja no relatório).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Alocacao {
    pub destinacao_id: Option<i64>,
    pub qtd: i64,
}

fn consumir(fontes: &[(Option<i64>, i64)], qtd: i64) -> Result<Vec<Alocacao>, ErroDominio> {
    if qtd <= 0 {
        return Err(ErroDominio::QuantidadeInvalida);
    }
    let mut restante = qtd;
    let mut alocacoes = Vec::new();
    for &(id, saldo) in fontes {
        if restante == 0 {
            break;
        }
        let usar = restante.min(saldo.max(0));
        if usar > 0 {
            alocacoes.push(Alocacao {
                destinacao_id: id,
                qtd: usar,
            });
            restante -= usar;
        }
    }
    if restante > 0 {
        // Nunca deve ocorrer: o estoque físico já barra a saída (FR-003).
        return Err(ErroDominio::EstoqueNegativo);
    }
    Ok(alocacoes)
}

/// Venda: carimbos na ordem recebida (cadastro, Loja 1ª) e por último o livre.
pub fn alocar_venda(
    carimbos_ordenados: &[(i64, i64)],
    livre: i64,
    qtd: i64,
) -> Result<Vec<Alocacao>, ErroDominio> {
    let mut fontes: Vec<(Option<i64>, i64)> = carimbos_ordenados
        .iter()
        .map(|&(id, s)| (Some(id), s))
        .collect();
    fontes.push((None, livre));
    consumir(&fontes, qtd)
}

#[cfg(test)]
mod tests {
    use super::*;

    const LOJA: i64 = 1;
    const MISSOES: i64 = 2;

    fn a(id: Option<i64>, qtd: i64) -> Alocacao {
        Alocacao {
            destinacao_id: id,
            qtd,
        }
    }

    #[test]
    fn venda_consome_carimbos_antes_do_livre() {
        // Loja 1 + Missões 210, livre 0 — o caso da fronteira (US2).
        let r = alocar_venda(&[(LOJA, 1), (MISSOES, 210)], 0, 2).unwrap();
        assert_eq!(r, vec![a(Some(LOJA), 1), a(Some(MISSOES), 1)]);

        // 1.000 livres + 10 Loja + 20 Missões: os 30 carimbados saem primeiro.
        let r = alocar_venda(&[(LOJA, 10), (MISSOES, 20)], 1000, 45).unwrap();
        assert_eq!(
            r,
            vec![a(Some(LOJA), 10), a(Some(MISSOES), 20), a(None, 15)]
        );
    }

    #[test]
    fn venda_sem_carimbo_vai_toda_para_o_livre() {
        let r = alocar_venda(&[], 50, 3).unwrap();
        assert_eq!(r, vec![a(None, 3)]);
    }

    #[test]
    fn venda_pula_carimbo_zerado() {
        let r = alocar_venda(&[(LOJA, 0), (MISSOES, 5)], 10, 6).unwrap();
        assert_eq!(r, vec![a(Some(MISSOES), 5), a(None, 1)]);
    }

    #[test]
    fn saida_maior_que_o_total_e_erro() {
        assert_eq!(
            alocar_venda(&[(MISSOES, 2)], 1, 4),
            Err(ErroDominio::EstoqueNegativo)
        );
    }

    #[test]
    fn quantidade_invalida() {
        assert_eq!(
            alocar_venda(&[], 10, 0),
            Err(ErroDominio::QuantidadeInvalida)
        );
    }
}

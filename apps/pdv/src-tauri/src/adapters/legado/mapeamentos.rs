//! Mapeamentos do legado Access → domínio (T050, validados contra amostra real).

use crate::domain::pagamento::Turno;

/// `vdturma`: "1" → Manhã, "2" → Tarde (default seguro: Manhã).
pub fn turma_para_turno(vdturma: &str) -> Turno {
    match vdturma.trim() {
        "2" => Turno::Tarde,
        _ => Turno::Manha,
    }
}

/// "dd/mm/yyyy" → "yyyy-mm-dd". Se não casar, devolve o texto original aparado.
pub fn data_iso(vddata: &str) -> String {
    let p: Vec<&str> = vddata.trim().split('/').collect();
    if p.len() == 3 && p[2].len() == 4 {
        format!("{}-{:0>2}-{:0>2}", p[2], p[1], p[0])
    } else {
        vddata.trim().to_string()
    }
}

/// Valor decimal do legado ("30.0000") → centavos.
pub fn valor_para_centavos(v: &str) -> i64 {
    let n: f64 = v.trim().parse().unwrap_or(0.0);
    (n * 100.0).round() as i64
}

/// Double do legado ("5.0000") → inteiro (estoque).
pub fn double_para_i64(v: &str) -> i64 {
    let n: f64 = v.trim().parse().unwrap_or(0.0);
    n.round() as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn turma() {
        assert_eq!(turma_para_turno("1"), Turno::Manha);
        assert_eq!(turma_para_turno("2"), Turno::Tarde);
        assert_eq!(turma_para_turno("0.0000"), Turno::Manha);
    }

    #[test]
    fn data() {
        assert_eq!(data_iso("05/07/2025"), "2025-07-05");
        assert_eq!(data_iso("5/7/2025"), "2025-07-05");
    }

    #[test]
    fn valores() {
        assert_eq!(valor_para_centavos("30.0000"), 3000);
        assert_eq!(valor_para_centavos("28.5"), 2850);
        assert_eq!(double_para_i64("5.0000"), 5);
    }
}

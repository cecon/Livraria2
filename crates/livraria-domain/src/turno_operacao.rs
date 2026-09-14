//! Turno de operação (ADR-0021): sessão de trabalho com ciclo abrir → vender →
//! encerrar. Entidade **pura** (sem I/O), compartilhada PDV↔Escritório via WASM
//! (ADR-0022). Distinto do enum `Turno` (horário Manhã/Tarde, `pagamento.rs`).
//!
//! Regras: uma venda só ocorre num turno `Aberto`; o Pedido Nº é sequencial por
//! turno (1..n); o fechamento de caixa confere **só o dinheiro** (clarify Q1 da
//! feature 009) — cartão/PIX entram no resumo apenas como informativos.

use super::dinheiro::Dinheiro;
use super::pedido::{por_forma_id, Pagamentos};

/// Estado do turno de operação.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StatusTurno {
    Aberto,
    Encerrado,
}

impl StatusTurno {
    pub fn as_str(self) -> &'static str {
        match self {
            StatusTurno::Aberto => "aberto",
            StatusTurno::Encerrado => "encerrado",
        }
    }

    /// Desconhecido cai em `Aberto` (conservador: não fecha por leitura ambígua).
    pub fn de_str(s: &str) -> StatusTurno {
        match s {
            "encerrado" => StatusTurno::Encerrado,
            _ => StatusTurno::Aberto,
        }
    }
}

/// Resultado da conferência de caixa no encerramento. `diferenca` em centavos,
/// pode ser negativa (faltou) ou positiva (sobrou); nunca impede o encerramento.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Fechamento {
    pub esperado: Dinheiro,
    pub conferido: Dinheiro,
    pub diferenca: i64,
}

/// Agregados do turno para o fechamento. `por_forma` preserva a ordem de aparição
/// (informativo); `esperado_dinheiro` = caixa inicial + recebido na forma Dinheiro.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResumoCaixa {
    pub qtd_vendas: i64,
    pub por_forma: Vec<(i64, Dinheiro)>,
    pub esperado_dinheiro: Dinheiro,
}

/// Turno de operação. `operador` é a identidade real do operador (uid); no
/// Escritório vem do `app_user`, nunca de uma sessão compartilhada.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TurnoOperacao {
    pub operador: String,
    pub caixa_inicial: Dinheiro,
    pub status: StatusTurno,
    pub abertura: String,
    pub encerramento: Option<Fechamento>,
}

impl TurnoOperacao {
    /// Abre um turno (ação explícita). Caixa inicial opcional (default zero).
    pub fn abrir(operador: impl Into<String>, caixa_inicial: Option<Dinheiro>, abertura: impl Into<String>) -> Self {
        TurnoOperacao {
            operador: operador.into(),
            caixa_inicial: caixa_inicial.unwrap_or(Dinheiro::ZERO),
            status: StatusTurno::Aberto,
            abertura: abertura.into(),
            encerramento: None,
        }
    }

    /// Aplica o fechamento e transita para `Encerrado` (idempotente por natureza:
    /// re-encerrar sobrescreve o fechamento com o mesmo cálculo).
    pub fn marcar_encerrado(&mut self, fechamento: Fechamento) {
        self.status = StatusTurno::Encerrado;
        self.encerramento = Some(fechamento);
    }
}

/// Uma venda só pode ser registrada num turno `Aberto`.
pub fn pode_registrar_venda(status: StatusTurno) -> bool {
    status == StatusTurno::Aberto
}

/// Próximo Pedido Nº dentro do turno (1..n) a partir da contagem atual.
pub fn proximo_numero(qtd_no_turno: i64) -> i64 {
    qtd_no_turno + 1
}

/// Retenção local do PDV: turnos com mais de 45 dias são podados (feature 013).
pub const RETENCAO_DIAS: i64 = 45;

/// Pode abrir um novo turno? Só se NÃO há turno aberto no PDV — **um único turno
/// aberto por vez** (FR-017). Havendo um aberto, o operador continua nele.
pub fn pode_abrir(ha_turno_aberto: bool) -> bool {
    !ha_turno_aberto
}

/// Cancelamento só é permitido para venda **do turno aberto** (FR-003). `None` em
/// qualquer lado (venda sem turno, ou nenhum turno aberto) ⇒ não permite.
pub fn pode_cancelar(venda_turno_uid: Option<&str>, turno_aberto_uid: Option<&str>) -> bool {
    matches!((venda_turno_uid, turno_aberto_uid), (Some(v), Some(a)) if v == a)
}

/// Turno é podável localmente (retenção — FR-007/008): **encerrado** e aberto há
/// mais de `dias` dias corridos. A checagem de "já sincronizado" é do adapter.
pub fn turno_podavel(status: StatusTurno, abertura_iso: &str, hoje_iso: &str, dias: i64) -> bool {
    if status != StatusTurno::Encerrado {
        return false;
    }
    match (crate::pedido::dias_civis(abertura_iso), crate::pedido::dias_civis(hoje_iso)) {
        (Some(a), Some(h)) => (h - a) > dias,
        _ => false,
    }
}

/// Resume o fechamento a partir de todos os recebimentos do turno. O **esperado
/// conferível** é só o dinheiro: `caixa_inicial + Σ recebido na forma Dinheiro`.
/// As demais formas voltam em `por_forma` como informativos (clarify Q1).
pub fn resumir_fechamento(
    pagamentos: &Pagamentos,
    caixa_inicial: Dinheiro,
    dinheiro_forma_id: i64,
    qtd_vendas: i64,
) -> ResumoCaixa {
    let mut por_forma: Vec<(i64, Dinheiro)> = Vec::new();
    for r in pagamentos {
        if let Some(existente) = por_forma.iter_mut().find(|(id, _)| *id == r.forma_id) {
            existente.1 = existente.1.soma(r.valor);
        } else {
            por_forma.push((r.forma_id, r.valor));
        }
    }
    let esperado_dinheiro = caixa_inicial.soma(por_forma_id(pagamentos, dinheiro_forma_id));
    ResumoCaixa {
        qtd_vendas,
        por_forma,
        esperado_dinheiro,
    }
}

/// Fechamento de caixa: `diferenca = conferido − esperado` (centavos). Não bloqueia
/// o encerramento quando difere.
pub fn encerrar(esperado: Dinheiro, conferido: Dinheiro) -> Fechamento {
    Fechamento {
        esperado,
        conferido,
        diferenca: conferido.centavos() - esperado.centavos(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pedido::Recebimento;

    const DINHEIRO_ID: i64 = 3;
    const CREDITO_ID: i64 = 1;

    fn recebe(forma_id: i64, centavos: i64) -> Recebimento {
        Recebimento {
            forma_id,
            valor: Dinheiro::de_centavos(centavos),
        }
    }

    #[test]
    fn abrir_inicia_aberto_com_caixa() {
        let t = TurnoOperacao::abrir("op-1", Some(Dinheiro::de_centavos(10000)), "2026-07-22T08:00");
        assert_eq!(t.status, StatusTurno::Aberto);
        assert_eq!(t.caixa_inicial.centavos(), 10000);
        assert!(t.encerramento.is_none());
        // Sem caixa inicial → zero.
        let t0 = TurnoOperacao::abrir("op-1", None, "2026-07-22T08:00");
        assert_eq!(t0.caixa_inicial, Dinheiro::ZERO);
    }

    #[test]
    fn um_unico_turno_aberto_por_pdv() {
        assert!(pode_abrir(false)); // não há aberto → pode
        assert!(!pode_abrir(true)); // já há aberto → continua no existente
    }

    #[test]
    fn cancela_somente_do_turno_aberto() {
        assert!(pode_cancelar(Some("t1"), Some("t1")));
        assert!(!pode_cancelar(Some("t1"), Some("t2"))); // outra turno
        assert!(!pode_cancelar(None, Some("t1"))); // venda sem turno (legado)
        assert!(!pode_cancelar(Some("t1"), None)); // nenhum turno aberto
    }

    #[test]
    fn poda_so_turno_encerrado_e_antigo() {
        // encerrado e 46 dias atrás → podável (> 45)
        assert!(turno_podavel(StatusTurno::Encerrado, "2026-06-01", "2026-07-17", 45));
        // encerrado e exatamente 45 dias → NÃO (precisa > 45)
        assert!(!turno_podavel(StatusTurno::Encerrado, "2026-06-01", "2026-07-16", 45));
        // aberto, mesmo antigo → nunca podável
        assert!(!turno_podavel(StatusTurno::Aberto, "2026-06-01", "2026-07-17", 45));
        // data (com hora) também parseia
        assert!(turno_podavel(StatusTurno::Encerrado, "2026-06-01T09:30:00", "2026-08-01", 45));
    }

    #[test]
    fn venda_so_em_turno_aberto() {
        assert!(pode_registrar_venda(StatusTurno::Aberto));
        assert!(!pode_registrar_venda(StatusTurno::Encerrado));
    }

    #[test]
    fn numero_sequencial_por_turno() {
        assert_eq!(proximo_numero(0), 1);
        assert_eq!(proximo_numero(1), 2);
        assert_eq!(proximo_numero(41), 42);
    }

    #[test]
    fn esperado_confere_so_o_dinheiro() {
        // 2 vendas: uma em dinheiro (4000) + crédito (6000); outra em dinheiro (1500).
        let pags = vec![
            recebe(CREDITO_ID, 6000),
            recebe(DINHEIRO_ID, 4000),
            recebe(DINHEIRO_ID, 1500),
        ];
        let r = resumir_fechamento(&pags, Dinheiro::de_centavos(10000), DINHEIRO_ID, 2);
        assert_eq!(r.qtd_vendas, 2);
        // esperado só do dinheiro: caixa 10000 + (4000 + 1500) = 15500.
        assert_eq!(r.esperado_dinheiro.centavos(), 15500);
        // por_forma agrega e preserva ordem de aparição (crédito, dinheiro).
        assert_eq!(r.por_forma[0], (CREDITO_ID, Dinheiro::de_centavos(6000)));
        assert_eq!(r.por_forma[1], (DINHEIRO_ID, Dinheiro::de_centavos(5500)));
    }

    #[test]
    fn encerrar_calcula_diferenca_e_transita() {
        let esperado = Dinheiro::de_centavos(15500);
        // Conferido a mais (sobra +200).
        let f = encerrar(esperado, Dinheiro::de_centavos(15700));
        assert_eq!(f.diferenca, 200);
        // Conferido a menos (falta -500) — não bloqueia.
        let f2 = encerrar(esperado, Dinheiro::de_centavos(15000));
        assert_eq!(f2.diferenca, -500);

        let mut t = TurnoOperacao::abrir("op-1", Some(esperado), "2026-07-22T08:00");
        t.marcar_encerrado(f);
        assert_eq!(t.status, StatusTurno::Encerrado);
        assert_eq!(t.encerramento.unwrap().diferenca, 200);
        assert!(!pode_registrar_venda(t.status));
    }

    #[test]
    fn status_ida_e_volta() {
        for s in [StatusTurno::Aberto, StatusTurno::Encerrado] {
            assert_eq!(StatusTurno::de_str(s.as_str()), s);
        }
        assert_eq!(StatusTurno::de_str("desconhecido"), StatusTurno::Aberto);
    }
}

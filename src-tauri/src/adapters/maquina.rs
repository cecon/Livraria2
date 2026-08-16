//! Adapter de identidade da máquina (feature 013): o **nome do PC**.
//!
//! Lê, nesta ordem:
//! 1. `COMPUTERNAME` — no Windows (alvo do PDV) está sempre no ambiente do processo;
//! 2. o hostname do próprio sistema operacional;
//! 3. `HOSTNAME` — variável de shell, presente em alguns ambientes;
//! 4. `"pdv"` — último recurso.
//!
//! O passo 2 existe porque depender só de variável de ambiente é frágil fora do
//! Windows: `HOSTNAME` é variável de shell e o zsh **não a exporta**, então um app
//! de GUI enxerga vazio e todas as máquinas cairiam no mesmo nome `"pdv"` — que é
//! exatamente a colisão de identidade que a FR-015 existe para impedir, e em
//! silêncio. Perguntar ao SO custa uma chamada, feita UMA vez por execução.

use crate::application::ports::Maquina;
use std::sync::OnceLock;

pub struct MaquinaSistema;

static NOME: OnceLock<String> = OnceLock::new();

fn limpo(s: String) -> Option<String> {
    let s = s.trim().to_string();
    if s.is_empty() { None } else { Some(s) }
}

/// Hostname do SO. `hostname -s` devolve o nome curto no macOS e no Linux; no
/// Windows nem chega aqui (o `COMPUTERNAME` resolve antes).
fn hostname_do_sistema() -> Option<String> {
    let saida = std::process::Command::new("hostname").arg("-s").output().ok()?;
    if !saida.status.success() {
        return None;
    }
    limpo(String::from_utf8_lossy(&saida.stdout).to_string())
}

fn detectar() -> String {
    std::env::var("COMPUTERNAME")
        .ok()
        .and_then(limpo)
        .or_else(hostname_do_sistema)
        .or_else(|| std::env::var("HOSTNAME").ok().and_then(limpo))
        .unwrap_or_else(|| "pdv".to_string())
}

impl Maquina for MaquinaSistema {
    fn nome(&self) -> String {
        // Uma detecção por execução: o nome do PC não muda com o app aberto, e
        // isso é lido em todo registro de venda.
        NOME.get_or_init(detectar).clone()
    }
}

#[cfg(test)]
mod testes {
    use super::*;

    /// O nome precisa ser real e estável — nunca vazio, nunca variando entre
    /// chamadas (duas leituras diferentes seriam dois "PDVs" para o mesmo balcão).
    #[test]
    fn nome_e_estavel_e_nao_vazio() {
        let n = MaquinaSistema.nome();
        assert!(!n.trim().is_empty());
        assert_eq!(n, MaquinaSistema.nome());
    }

    /// Em qualquer ambiente com hostname configurado (dev, CI ou a loja), o
    /// fallback genérico não deve ser alcançado.
    #[test]
    fn usa_o_hostname_do_sistema_e_nao_o_fallback() {
        if hostname_do_sistema().is_some() {
            assert_ne!(MaquinaSistema.nome(), "pdv", "caiu no fallback tendo hostname");
        }
    }
}

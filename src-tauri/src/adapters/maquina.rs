//! Adapter de identidade da máquina (feature 013): o **nome do PC**.
//!
//! Sem dependência nova (KISS): lê o hostname do ambiente — `COMPUTERNAME` no
//! Windows (alvo do PDV, sempre presente) e `HOSTNAME` como fallback. Se nada
//! estiver disponível (ex.: dev/CI), cai em `"pdv"`.

use crate::application::ports::Maquina;

pub struct MaquinaSistema;

impl Maquina for MaquinaSistema {
    fn nome(&self) -> String {
        std::env::var("COMPUTERNAME")
            .or_else(|_| std::env::var("HOSTNAME"))
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "pdv".to_string())
    }
}

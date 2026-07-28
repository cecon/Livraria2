//! Perfil de usuário e regras de **acesso** (feature 010, ADR-0019). Domínio puro — a
//! MESMA regra vale no PDV (nativo) e no Escritório (WASM), sem duplicação (Princípio II).
//!
//! Regra do negócio: **operador → só o PDV**; **admin → PDV e Escritório**. O perfil controla
//! apenas *onde* a pessoa entra, não o que faz dentro do PDV (FR-017).

/// Perfil de acesso de um usuário. Mutuamente exclusivo.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Perfil {
    Operador,
    Admin,
}

impl Perfil {
    /// Interpreta o texto persistido. Desconhecido/vazio ⇒ `Operador` (fail-safe: menor
    /// privilégio — nunca conceder acesso de admin por dado sujo).
    pub fn de_texto(s: &str) -> Perfil {
        match s.trim().to_ascii_lowercase().as_str() {
            "admin" => Perfil::Admin,
            _ => Perfil::Operador,
        }
    }

    /// Forma canônica para persistir/sincronizar.
    pub fn as_str(&self) -> &'static str {
        match self {
            Perfil::Operador => "operador",
            Perfil::Admin => "admin",
        }
    }

    pub fn e_admin(&self) -> bool {
        matches!(self, Perfil::Admin)
    }
}

/// PDV: qualquer usuário **ativo** entra — operador e admin (FR-003/FR-004/FR-017).
pub fn pode_acessar_pdv(_perfil: Perfil, ativo: bool) -> bool {
    ativo
}

/// Escritório (a retaguarda na nuvem): só **admin ativo** (FR-004/FR-010).
pub fn pode_acessar_escritorio(perfil: Perfil, ativo: bool) -> bool {
    ativo && perfil.e_admin()
}

/// Guarda do último admin (FR-014/INV-2): `true` quando resta **um** admin ativo — então
/// rebaixar ou desativar um admin deve ser **bloqueado**.
pub fn e_ultimo_admin_ativo(qtd_admins_ativos: u32) -> bool {
    qtd_admins_ativos <= 1
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn texto_ida_e_volta_e_fail_safe() {
        assert_eq!(Perfil::de_texto("admin"), Perfil::Admin);
        assert_eq!(Perfil::de_texto("  ADMIN "), Perfil::Admin);
        assert_eq!(Perfil::de_texto("operador"), Perfil::Operador);
        // desconhecido/vazio ⇒ operador (menor privilégio)
        assert_eq!(Perfil::de_texto(""), Perfil::Operador);
        assert_eq!(Perfil::de_texto("gerente"), Perfil::Operador);
        assert_eq!(Perfil::Admin.as_str(), "admin");
        assert_eq!(Perfil::Operador.as_str(), "operador");
    }

    #[test]
    fn operador_so_pdv_admin_ambos() {
        // PDV: ambos os perfis ativos entram
        assert!(pode_acessar_pdv(Perfil::Operador, true));
        assert!(pode_acessar_pdv(Perfil::Admin, true));
        // Escritório: só admin
        assert!(!pode_acessar_escritorio(Perfil::Operador, true));
        assert!(pode_acessar_escritorio(Perfil::Admin, true));
    }

    #[test]
    fn desativado_nao_entra_em_lugar_nenhum() {
        assert!(!pode_acessar_pdv(Perfil::Operador, false));
        assert!(!pode_acessar_pdv(Perfil::Admin, false));
        assert!(!pode_acessar_escritorio(Perfil::Admin, false));
    }

    #[test]
    fn ultimo_admin_bloqueia() {
        assert!(e_ultimo_admin_ativo(1)); // resta 1 → bloquear rebaixar/desativar
        assert!(e_ultimo_admin_ativo(0)); // defensivo
        assert!(!e_ultimo_admin_ativo(2)); // há outro → permitido
    }
}

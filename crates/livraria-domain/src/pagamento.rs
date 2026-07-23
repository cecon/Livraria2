//! Formas de pagamento (cadastro gerenciável) e turno (Princípio VI — rótulos exatos).
//!
//! A forma é identificada por `chave` estável (snake_case, imutável); o `rotulo` é
//! livre. Comportamento (troco, legado) prende-se à chave, nunca ao rótulo (ADR-0013).

use serde::{Deserialize, Serialize};

/// Forma de pagamento do cadastro (FR-001). Apenas registro gerencial — sem TEF/fiscal.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormaPagamento {
    pub id: i64,
    /// Identidade estável em snake_case; imutável (troco/legado/seed — FR-001a).
    pub chave: String,
    pub rotulo: String,
    /// Formas de sistema não podem ser excluídas nem desativadas (FR-001a).
    pub de_sistema: bool,
    pub ativa: bool,
    pub ordem: i64,
}

impl FormaPagamento {
    /// Excluir só é permitido para formas não-de-sistema nunca usadas (FR-009).
    pub fn pode_excluir(&self, em_uso: bool) -> bool {
        !self.de_sistema && !em_uso
    }

    /// Desativar só é permitido para formas não-de-sistema (FR-007).
    pub fn pode_desativar(&self) -> bool {
        !self.de_sistema
    }
}

/// Valida o rótulo de uma forma: não pode ser vazio (FR-010).
pub fn nome_valido(rotulo: &str) -> bool {
    !rotulo.trim().is_empty()
}

/// Normaliza um rótulo para comparação de unicidade (FR-010/D9):
/// trim + minúsculas + remoção de diacríticos ("credito" = "Crédito" = " CRÉDITO ").
pub fn nome_normalizado(rotulo: &str) -> String {
    rotulo
        .trim()
        .to_lowercase()
        .chars()
        .map(|c| match c {
            'á' | 'à' | 'â' | 'ã' | 'ä' => 'a',
            'é' | 'è' | 'ê' | 'ë' => 'e',
            'í' | 'ì' | 'î' | 'ï' => 'i',
            'ó' | 'ò' | 'ô' | 'õ' | 'ö' => 'o',
            'ú' | 'ù' | 'û' | 'ü' => 'u',
            'ç' => 'c',
            'ñ' => 'n',
            _ => c,
        })
        .collect()
}

/// Chaves das formas de sistema — as únicas que o código conhece (FR-001a).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChaveSistema {
    Credito,
    Dinheiro,
    Pix,
    Ministerio,
    Vale,
}

impl ChaveSistema {
    pub fn chave(self) -> &'static str {
        match self {
            ChaveSistema::Credito => "credito",
            ChaveSistema::Dinheiro => "dinheiro",
            ChaveSistema::Pix => "pix",
            ChaveSistema::Ministerio => "ministerio",
            ChaveSistema::Vale => "vale",
        }
    }

    /// Mapeia o código de método do legado (`vdmetodo`) para a chave (ADR-0006/0013).
    /// "C" (cartão de crédito do legado) → Crédito; desconhecidos caem em Dinheiro.
    pub fn de_legado_metodo(codigo: &str) -> ChaveSistema {
        match codigo.trim().to_uppercase().as_str() {
            "C" => ChaveSistema::Credito,
            "P" => ChaveSistema::Pix,
            "M" => ChaveSistema::Ministerio,
            "V" => ChaveSistema::Vale,
            _ => ChaveSistema::Dinheiro, // "D" e desconhecidos
        }
    }
}

/// Ids das formas de sistema já resolvidos (chave → id) pela aplicação, para uso
/// em contextos sem acesso ao banco — ex.: o importador do legado (FR-018).
#[derive(Debug, Clone, Copy)]
pub struct FormaIds {
    pub credito: i64,
    pub dinheiro: i64,
    pub pix: i64,
    pub ministerio: i64,
    pub vale: i64,
}

impl FormaIds {
    pub fn id_de(self, chave: ChaveSistema) -> i64 {
        match chave {
            ChaveSistema::Credito => self.credito,
            ChaveSistema::Dinheiro => self.dinheiro,
            ChaveSistema::Pix => self.pix,
            ChaveSistema::Ministerio => self.ministerio,
            ChaveSistema::Vale => self.vale,
        }
    }
}

/// Turno derivado do horário de conclusão da venda (corte ~13h).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Turno {
    Manha,
    Tarde,
}

impl Turno {
    /// Manhã antes das 13h; tarde a partir daí.
    pub fn de_hora(hora: u32) -> Turno {
        if hora < 13 {
            Turno::Manha
        } else {
            Turno::Tarde
        }
    }

    pub fn rotulo(self) -> &'static str {
        match self {
            Turno::Manha => "Turma da Manhã",
            Turno::Tarde => "Turma da Tarde",
        }
    }

    /// Chave estável para persistência/filtro de relatórios.
    pub fn chave(self) -> &'static str {
        match self {
            Turno::Manha => "manha",
            Turno::Tarde => "tarde",
        }
    }

    pub fn de_chave(chave: &str) -> Turno {
        match chave {
            "tarde" => Turno::Tarde,
            _ => Turno::Manha,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn forma(chave: &str, de_sistema: bool) -> FormaPagamento {
        FormaPagamento {
            id: 1,
            chave: chave.into(),
            rotulo: "X".into(),
            de_sistema,
            ativa: true,
            ordem: 0,
        }
    }

    #[test]
    fn metodo_legado_mapeia_por_chave() {
        assert_eq!(ChaveSistema::de_legado_metodo("C"), ChaveSistema::Credito);
        assert_eq!(ChaveSistema::de_legado_metodo("p"), ChaveSistema::Pix);
        assert_eq!(ChaveSistema::de_legado_metodo("M"), ChaveSistema::Ministerio);
        assert_eq!(ChaveSistema::de_legado_metodo("V"), ChaveSistema::Vale);
        assert_eq!(ChaveSistema::de_legado_metodo("d"), ChaveSistema::Dinheiro);
        assert_eq!(ChaveSistema::de_legado_metodo("?"), ChaveSistema::Dinheiro);
    }

    #[test]
    fn guards_de_sistema_e_uso() {
        assert!(!forma("dinheiro", true).pode_desativar());
        assert!(!forma("dinheiro", true).pode_excluir(false));
        assert!(forma("boleto", false).pode_desativar());
        assert!(forma("boleto", false).pode_excluir(false));
        assert!(!forma("boleto", false).pode_excluir(true)); // em uso
    }

    #[test]
    fn nome_normalizado_caixa_acentos_e_trim() {
        assert_eq!(nome_normalizado(" CRÉDITO "), "credito");
        assert_eq!(nome_normalizado("Crédito"), nome_normalizado("credito"));
        assert_eq!(nome_normalizado("Ministério"), "ministerio");
        assert_eq!(nome_normalizado("Ação"), "acao");
        assert!(nome_valido("Boleto"));
        assert!(!nome_valido("   "));
    }

    #[test]
    fn turno_por_hora() {
        assert_eq!(Turno::de_hora(9), Turno::Manha);
        assert_eq!(Turno::de_hora(12), Turno::Manha);
        assert_eq!(Turno::de_hora(13), Turno::Tarde);
        assert_eq!(Turno::de_hora(18), Turno::Tarde);
    }

    #[test]
    fn turno_chave_ida_e_volta() {
        for t in [Turno::Manha, Turno::Tarde] {
            assert_eq!(Turno::de_chave(t.chave()), t);
        }
        assert_eq!(Turno::Manha.rotulo(), "Turma da Manhã");
        assert_eq!(Turno::Tarde.rotulo(), "Turma da Tarde");
    }
}

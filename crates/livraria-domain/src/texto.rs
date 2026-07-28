//! Normalização de texto para busca insensível a acento e caixa (FR-021, SC-003).
//! Sem dependência externa (KISS): mapeia os acentos do pt-BR para ASCII.

/// Normaliza para busca: minúsculo + sem acento. Ex.: "Bíblia" ⇒ "biblia".
pub fn normalize(entrada: &str) -> String {
    entrada
        .chars()
        .map(remover_acento)
        .collect::<String>()
        .to_lowercase()
}

/// Padroniza cadastro: CAIXA ALTA + sem acento, aparado. Ex.: "Bíblia" ⇒ "BIBLIA".
pub fn caixa_alta_sem_acento(entrada: &str) -> String {
    entrada
        .trim()
        .chars()
        .map(remover_acento)
        .collect::<String>()
        .to_uppercase()
}

fn remover_acento(c: char) -> char {
    match c {
        'á' | 'à' | 'â' | 'ã' | 'ä' => 'a',
        'Á' | 'À' | 'Â' | 'Ã' | 'Ä' => 'A',
        'é' | 'è' | 'ê' | 'ë' => 'e',
        'É' | 'È' | 'Ê' | 'Ë' => 'E',
        'í' | 'ì' | 'î' | 'ï' => 'i',
        'Í' | 'Ì' | 'Î' | 'Ï' => 'I',
        'ó' | 'ò' | 'ô' | 'õ' | 'ö' => 'o',
        'Ó' | 'Ò' | 'Ô' | 'Õ' | 'Ö' => 'O',
        'ú' | 'ù' | 'û' | 'ü' => 'u',
        'Ú' | 'Ù' | 'Û' | 'Ü' => 'U',
        'ç' => 'c',
        'Ç' => 'C',
        'ñ' => 'n',
        'Ñ' => 'N',
        outro => outro,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn remove_acento_e_caixa() {
        assert_eq!(normalize("Bíblia"), "biblia");
        assert_eq!(normalize("DEVOCIONÁRIO"), "devocionario");
        assert_eq!(normalize("Coração"), "coracao");
        assert_eq!(normalize("João"), "joao");
    }

    #[test]
    fn termo_sem_acento_casa_com_titulo_acentuado() {
        // simula a busca de FR-021: usuário digita "biblia", acervo tem "Bíblia"
        assert_eq!(normalize("biblia"), normalize("Bíblia"));
        assert_eq!(normalize("FAMILIA"), normalize("Família"));
    }

    #[test]
    fn texto_sem_acento_inalterado() {
        assert_eq!(normalize("Genesis 1"), "genesis 1");
    }

    #[test]
    fn padroniza_cadastro_caixa_alta_sem_acento() {
        assert_eq!(caixa_alta_sem_acento("Bíblia de Estudo"), "BIBLIA DE ESTUDO");
        assert_eq!(caixa_alta_sem_acento("  João Calvino  "), "JOAO CALVINO");
        assert_eq!(caixa_alta_sem_acento("Coração"), "CORACAO");
    }
}

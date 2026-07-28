//! Regras puras da sincronização com a nuvem (ADR-0015/0016).
//!
//! Sem I/O, sem rede, sem SeaORM/Tauri: só decisões — ordem de dependência
//! (pais→filhas), last-write-wins, deduplicação por chave natural, propagação de
//! exclusão (soft delete) e detecção de órfã. O adapter/aplicação usam estas
//! funções; a fala com a nuvem fica na borda.

use std::collections::HashSet;

/// Recursos sincronizáveis na **ordem de dependência** (pais antes de filhas).
/// Push, seed e aplicação de pull seguem esta ordem para respeitar as FKs
/// enforced na nuvem (por `sync_uid`) e as FKs locais.
pub const ORDEM_DEPENDENCIA: &[&str] = &[
    // Pais sem dependência entre si.
    "livro",
    "fornecedor",
    "usuario",
    "forma_pagamento",
    "destinacao",
    // Dependem dos pais acima.
    "turno_operacao",           // operador -> usuario (antes de pedido; ADR-0021)
    "pedido",                   // operador -> usuario; turno -> turno_operacao
    "lancamento_entrada",       // -> fornecedor
    "movimento_estoque",        // -> livro
    "transferencia_destinacao", // -> livro, destinacao
    // Dependem do nível anterior.
    "item_pedido",      // -> pedido
    "pagamento_pedido", // -> pedido, forma_pagamento
    "item_lancamento",  // -> lancamento_entrada, livro
    "alocacao_venda",   // -> pedido, item_pedido, destinacao
];

/// Chave natural de deduplicação por recurso (além do `sync_uid`). `None` = a
/// identidade é só o `sync_uid` (eventos e itens não deduplicam por conteúdo).
pub fn chave_natural(recurso: &str) -> Option<&'static str> {
    match recurso {
        "livro" => Some("codigo"),
        "fornecedor" => Some("nome_norm"),
        "usuario" => Some("usuario"),
        "forma_pagamento" => Some("chave"),
        "destinacao" => Some("nome_norm"),
        _ => None,
    }
}

/// Um registro está logicamente excluído se tem `excluido_em` preenchido (D8).
pub fn excluido(excluido_em: Option<&str>) -> bool {
    matches!(excluido_em, Some(s) if !s.is_empty())
}

/// O que fazer com um registro remoto ao aplicar um pull, dado o estado local.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Decisao {
    /// Não existe local: inserir.
    Inserir,
    /// Existe local e o remoto é mais novo: sobrescrever (last-write-wins).
    Atualizar,
    /// Existe local igual ou mais novo: ignorar (idempotência).
    Ignorar,
}

/// Decide a aplicação por **last-write-wins** (D7). Timestamps são ISO-8601 em UTC
/// carimbados pela referência do servidor (D9) — comparação lexicográfica é válida.
/// Empate mantém o local (estável e idempotente: re-aplicar o mesmo não muda nada).
pub fn decidir_aplicacao(local_atualizado_em: Option<&str>, remoto_atualizado_em: &str) -> Decisao {
    match local_atualizado_em {
        None => Decisao::Inserir,
        Some(local) if remoto_atualizado_em > local => Decisao::Atualizar,
        Some(_) => Decisao::Ignorar,
    }
}

/// Um registro-filho é **órfão** se sua referência (obrigatória) a um pai não
/// existe no conjunto de pais conhecidos (FR-012, D11). Referência opcional
/// ausente (`None`) não é órfã.
pub fn e_orfao(referencia_pai: Option<&str>, pais_conhecidos: &HashSet<String>) -> bool {
    match referencia_pai {
        Some(uid) => !pais_conhecidos.contains(uid),
        None => false,
    }
}

/// Saldo derivado de um livro = soma das quantidades dos movimentos **não
/// excluídos** (ADR-0008). Convergência (SC-003): dois lados com o mesmo conjunto
/// de movimentos chegam ao mesmo saldo, independentemente da ordem de chegada.
pub fn saldo_dos_movimentos<'a>(movimentos: impl IntoIterator<Item = (i64, Option<&'a str>)>) -> i64 {
    movimentos
        .into_iter()
        .filter(|(_, excluido_em)| !excluido(*excluido_em))
        .map(|(qtd, _)| qtd)
        .sum()
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn ordem_poe_pais_antes_das_filhas() {
        let pos = |r: &str| ORDEM_DEPENDENCIA.iter().position(|x| *x == r).unwrap();
        assert!(pos("livro") < pos("movimento_estoque"));
        assert!(pos("pedido") < pos("item_pedido"));
        assert!(pos("pedido") < pos("pagamento_pedido"));
        assert!(pos("forma_pagamento") < pos("pagamento_pedido"));
        assert!(pos("usuario") < pos("pedido")); // operador
        assert!(pos("usuario") < pos("turno_operacao")); // operador do turno
        assert!(pos("turno_operacao") < pos("pedido")); // pedido.turno_uid -> turno_operacao
        assert!(pos("fornecedor") < pos("lancamento_entrada"));
        assert!(pos("lancamento_entrada") < pos("item_lancamento"));
        assert!(pos("destinacao") < pos("alocacao_venda"));
        assert!(pos("item_pedido") < pos("alocacao_venda"));
    }

    #[test]
    fn chaves_naturais_por_recurso() {
        assert_eq!(chave_natural("livro"), Some("codigo"));
        assert_eq!(chave_natural("fornecedor"), Some("nome_norm"));
        assert_eq!(chave_natural("usuario"), Some("usuario"));
        assert_eq!(chave_natural("movimento_estoque"), None);
        assert_eq!(chave_natural("item_pedido"), None);
    }

    #[test]
    fn excluido_reconhece_soft_delete() {
        assert!(!excluido(None));
        assert!(!excluido(Some("")));
        assert!(excluido(Some("2026-07-20T10:00:00Z")));
    }

    #[test]
    fn lww_insere_atualiza_ou_ignora() {
        assert_eq!(decidir_aplicacao(None, "2026-07-20T10:00:00Z"), Decisao::Inserir);
        // remoto mais novo vence
        assert_eq!(
            decidir_aplicacao(Some("2026-07-20T10:00:00Z"), "2026-07-20T11:00:00Z"),
            Decisao::Atualizar
        );
        // local mais novo prevalece
        assert_eq!(
            decidir_aplicacao(Some("2026-07-20T11:00:00Z"), "2026-07-20T10:00:00Z"),
            Decisao::Ignorar
        );
        // empate mantém local (idempotente)
        assert_eq!(
            decidir_aplicacao(Some("2026-07-20T10:00:00Z"), "2026-07-20T10:00:00Z"),
            Decisao::Ignorar
        );
    }

    #[test]
    fn orfa_quando_pai_ausente() {
        let mut pais = HashSet::new();
        pais.insert("uid-livro-1".to_string());
        assert!(!e_orfao(Some("uid-livro-1"), &pais)); // pai existe
        assert!(e_orfao(Some("uid-livro-2"), &pais)); // pai ausente -> órfã
        assert!(!e_orfao(None, &pais)); // referência opcional ausente não é órfã
    }

    #[test]
    fn saldo_soma_movimentos_ignorando_excluidos() {
        // entrada +5 (escritório), saída -2 (pdv), entrada +3 excluída (não conta)
        let movs = vec![
            (5_i64, None),
            (-2_i64, None),
            (3_i64, Some("2026-07-20T12:00:00Z")),
        ];
        assert_eq!(saldo_dos_movimentos(movs), 3);
    }

    #[test]
    fn saldo_independe_da_ordem_de_chegada() {
        let a = saldo_dos_movimentos(vec![(5_i64, None), (-2_i64, None)]);
        let b = saldo_dos_movimentos(vec![(-2_i64, None), (5_i64, None)]);
        assert_eq!(a, b); // convergência: soma é comutativa
    }
}

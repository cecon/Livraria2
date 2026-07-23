//! Mapa de sincronização por recurso (feature 007): colunas, tipos, FKs remapeadas.
//! Fonte da tradução SQLite↔nuvem usada pelo `replica_sync`.

use sea_orm::Value;

#[derive(Clone, Copy)]
pub(crate) enum Tipo {
    Texto,
    Inteiro,
    Bool,
}
pub(crate) struct Col {
    pub nome: &'static str,
    pub tipo: Tipo,
}

/// FK remapeada por `sync_uid`. Na nuvem vira `uid_key`; localmente é `col_local`,
/// que casa com a coluna `chave_local_pai` do `pai` (normalmente `id`, mas p.ex.
/// `pedido.numero` ou `usuario.usuario`).
pub(crate) struct Ref {
    pub uid_key: &'static str,
    pub col_local: &'static str,
    pub pai: &'static str,
    pub chave_local_pai: &'static str,
}

pub(crate) struct Spec {
    pub recurso: &'static str,
    /// true = cadastro (upsert com LWW); false = evento (DO NOTHING).
    pub mutavel: bool,
    pub default_insert: &'static [(&'static str, &'static str)],
    pub cols: &'static [Col],
    pub refs: &'static [Ref],
}

use Tipo::{Bool, Inteiro, Texto};

const fn rid(uid: &'static str, local: &'static str, pai: &'static str) -> Ref {
    Ref { uid_key: uid, col_local: local, pai, chave_local_pai: "id" }
}

pub(crate) const SPECS: &[Spec] = &[
    Spec {
        recurso: "livro",
        mutavel: true,
        default_insert: &[],
        cols: &[
            Col { nome: "codigo", tipo: Texto },
            Col { nome: "titulo", tipo: Texto },
            Col { nome: "autor", tipo: Texto },
            Col { nome: "preco_centavos", tipo: Inteiro },
            Col { nome: "categoria", tipo: Inteiro },
            Col { nome: "descricao", tipo: Texto },
            Col { nome: "busca_norm", tipo: Texto },
            Col { nome: "ativo", tipo: Bool },
        ],
        refs: &[],
    },
    Spec {
        recurso: "fornecedor",
        mutavel: true,
        default_insert: &[],
        cols: &[
            Col { nome: "nome", tipo: Texto },
            Col { nome: "nome_norm", tipo: Texto },
            Col { nome: "documento", tipo: Texto },
            Col { nome: "telefone", tipo: Texto },
            Col { nome: "email", tipo: Texto },
            Col { nome: "observacoes", tipo: Texto },
            Col { nome: "ativo", tipo: Bool },
        ],
        refs: &[],
    },
    // Operador do PDV: identidade só; senha_hash='' no insert (senha pendente — D15).
    Spec {
        recurso: "usuario",
        mutavel: true,
        default_insert: &[("senha_hash", "")],
        cols: &[Col { nome: "usuario", tipo: Texto }, Col { nome: "nome", tipo: Texto }],
        refs: &[],
    },
    Spec {
        recurso: "forma_pagamento",
        mutavel: true,
        default_insert: &[],
        cols: &[
            Col { nome: "chave", tipo: Texto },
            Col { nome: "rotulo", tipo: Texto },
            Col { nome: "de_sistema", tipo: Bool },
            Col { nome: "ativa", tipo: Bool },
            Col { nome: "ordem", tipo: Inteiro },
        ],
        refs: &[],
    },
    Spec {
        recurso: "destinacao",
        mutavel: true,
        default_insert: &[],
        cols: &[
            Col { nome: "nome", tipo: Texto },
            Col { nome: "nome_norm", tipo: Texto },
            Col { nome: "de_sistema", tipo: Bool },
            Col { nome: "ativa", tipo: Bool },
            Col { nome: "ordem", tipo: Inteiro },
        ],
        refs: &[],
    },
    // Turno de operação (ADR-0021): mutável (status/encerramento → LWW). Operador
    // referencia usuario por `usuario` (mesmo remap do pedido).
    Spec {
        recurso: "turno_operacao",
        mutavel: true,
        default_insert: &[],
        cols: &[
            Col { nome: "caixa_inicial_centavos", tipo: Inteiro },
            Col { nome: "status", tipo: Texto },
            Col { nome: "abertura", tipo: Texto },
            Col { nome: "encerramento", tipo: Texto },
            Col { nome: "esperado_centavos", tipo: Inteiro },
            Col { nome: "conferido_centavos", tipo: Inteiro },
            Col { nome: "diferenca_centavos", tipo: Inteiro },
        ],
        refs: &[Ref { uid_key: "operador_uid", col_local: "operador", pai: "usuario", chave_local_pai: "usuario" }],
    },
    // Venda: mutável (cancelamento); operador referencia usuario por `usuario`;
    // turno_uid é o sync_uid do turno (pass-through, valida o pai existir).
    Spec {
        recurso: "pedido",
        mutavel: true,
        default_insert: &[],
        cols: &[
            Col { nome: "numero", tipo: Inteiro },
            Col { nome: "cliente", tipo: Texto },
            Col { nome: "turno", tipo: Texto },
            Col { nome: "data", tipo: Texto },
            Col { nome: "total_centavos", tipo: Inteiro },
            Col { nome: "cancelado", tipo: Bool },
            Col { nome: "cancelado_em", tipo: Texto },
            Col { nome: "numero_no_turno", tipo: Inteiro },
        ],
        refs: &[
            Ref { uid_key: "operador_uid", col_local: "operador", pai: "usuario", chave_local_pai: "usuario" },
            Ref { uid_key: "turno_uid", col_local: "turno_uid", pai: "turno_operacao", chave_local_pai: "sync_uid" },
        ],
    },
    Spec {
        recurso: "item_pedido",
        mutavel: false,
        default_insert: &[],
        cols: &[
            Col { nome: "codigo", tipo: Texto },
            Col { nome: "titulo", tipo: Texto },
            Col { nome: "preco_centavos", tipo: Inteiro },
            Col { nome: "qtd", tipo: Inteiro },
        ],
        refs: &[Ref { uid_key: "pedido_uid", col_local: "pedido_numero", pai: "pedido", chave_local_pai: "numero" }],
    },
    Spec {
        recurso: "pagamento_pedido",
        mutavel: false,
        default_insert: &[],
        cols: &[Col { nome: "valor_centavos", tipo: Inteiro }],
        refs: &[
            Ref { uid_key: "pedido_uid", col_local: "pedido_numero", pai: "pedido", chave_local_pai: "numero" },
            rid("forma_uid", "forma_id", "forma_pagamento"),
        ],
    },
    Spec {
        recurso: "lancamento_entrada",
        mutavel: true,
        default_insert: &[],
        cols: &[
            Col { nome: "numero", tipo: Texto },
            Col { nome: "data", tipo: Texto },
            Col { nome: "status", tipo: Texto },
            Col { nome: "finalizada_em", tipo: Texto },
        ],
        refs: &[rid("fornecedor_uid", "fornecedor_id", "fornecedor")],
    },
    Spec {
        recurso: "item_lancamento",
        mutavel: false,
        default_insert: &[],
        cols: &[Col { nome: "qtd", tipo: Inteiro }, Col { nome: "custo_unit_centavos", tipo: Inteiro }],
        refs: &[
            rid("lancamento_uid", "lancamento_id", "lancamento_entrada"),
            rid("livro_uid", "livro_id", "livro"),
        ],
    },
    // Estoque: evento append-only; FK livro por sync_uid.
    Spec {
        recurso: "movimento_estoque",
        mutavel: false,
        default_insert: &[],
        cols: &[
            Col { nome: "tipo", tipo: Texto },
            Col { nome: "qtd", tipo: Inteiro },
            Col { nome: "custo_unit_centavos", tipo: Inteiro },
            Col { nome: "fornecedor", tipo: Texto },
            Col { nome: "motivo", tipo: Texto },
            Col { nome: "referencia", tipo: Texto },
            Col { nome: "criado_em", tipo: Texto },
        ],
        refs: &[rid("livro_uid", "livro_id", "livro")],
    },
    // Destinação (006): transferências e alocações de venda.
    Spec {
        recurso: "transferencia_destinacao",
        mutavel: false,
        default_insert: &[],
        cols: &[Col { nome: "qtd", tipo: Inteiro }, Col { nome: "motivo", tipo: Texto }, Col { nome: "criado_em", tipo: Texto }],
        refs: &[
            rid("livro_uid", "livro_id", "livro"),
            rid("de_destinacao_uid", "de_destinacao_id", "destinacao"),
            rid("para_destinacao_uid", "para_destinacao_id", "destinacao"),
        ],
    },
    Spec {
        recurso: "alocacao_venda",
        mutavel: false,
        default_insert: &[],
        cols: &[Col { nome: "qtd", tipo: Inteiro }, Col { nome: "valor_centavos", tipo: Inteiro }],
        refs: &[
            Ref { uid_key: "pedido_uid", col_local: "pedido_numero", pai: "pedido", chave_local_pai: "numero" },
            rid("item_uid", "item_id", "item_pedido"),
            rid("destinacao_uid", "destinacao_id", "destinacao"),
        ],
    },
];

pub(crate) fn spec(recurso: &str) -> Option<&'static Spec> {
    SPECS.iter().find(|s| s.recurso == recurso)
}

/// `json_object(...)` que produz a linha no formato da nuvem (bool 0/1→true/false;
/// `atualizado_em` vazio→null; FKs → `*_uid` pela chave do pai).
pub(crate) fn expr_json(s: &Spec) -> String {
    let mut p = vec![
        "'sync_uid',sync_uid".to_string(),
        "'origem',origem".to_string(),
        "'atualizado_em',iif(atualizado_em='',null,atualizado_em)".to_string(),
        "'excluido_em',excluido_em".to_string(),
    ];
    for c in s.cols {
        match c.tipo {
            Bool => p.push(format!("'{0}',json(iif({0},'true','false'))", c.nome)),
            _ => p.push(format!("'{0}',{0}", c.nome)),
        }
    }
    for r in s.refs {
        p.push(format!(
            "'{}',(select sync_uid from {} where {}=t.{})",
            r.uid_key, r.pai, r.chave_local_pai, r.col_local
        ));
    }
    format!("json_object({})", p.join(","))
}

/// Valor SeaORM (nullable) a partir de um campo do JSON da nuvem.
pub(crate) fn valor(dados: &serde_json::Value, chave: &str, tipo: Tipo) -> Value {
    let v = dados.get(chave);
    match tipo {
        Tipo::Bool => Value::BigInt(Some(i64::from(v.and_then(|x| x.as_bool()).unwrap_or(false)))),
        Tipo::Inteiro => Value::BigInt(v.and_then(|x| x.as_i64())),
        Tipo::Texto => Value::String(v.and_then(|x| x.as_str()).map(|s| Box::new(s.to_string()))),
    }
}

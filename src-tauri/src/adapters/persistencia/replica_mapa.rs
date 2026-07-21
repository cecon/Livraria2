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

/// FK remapeada: `uid_key` na nuvem ↔ `col_local` (id) resolvida pelo `pai`.
pub(crate) struct Ref {
    pub uid_key: &'static str,
    pub col_local: &'static str,
    pub pai: &'static str,
}

pub(crate) struct Spec {
    pub recurso: &'static str,
    /// true = cadastro (upsert com LWW); false = evento (DO NOTHING).
    pub mutavel: bool,
    /// coluna literal setada só no INSERT (ex.: usuario.senha_hash='' = senha pendente).
    pub default_insert: &'static [(&'static str, &'static str)],
    pub cols: &'static [Col],
    pub refs: &'static [Ref],
}

use Tipo::{Bool, Inteiro, Texto};

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
        recurso: "lancamento_entrada",
        mutavel: true,
        default_insert: &[],
        cols: &[
            Col { nome: "numero", tipo: Texto },
            Col { nome: "data", tipo: Texto },
            Col { nome: "status", tipo: Texto },
            Col { nome: "finalizada_em", tipo: Texto },
        ],
        refs: &[Ref { uid_key: "fornecedor_uid", col_local: "fornecedor_id", pai: "fornecedor" }],
    },
    Spec {
        recurso: "item_lancamento",
        mutavel: false,
        default_insert: &[],
        cols: &[Col { nome: "qtd", tipo: Inteiro }, Col { nome: "custo_unit_centavos", tipo: Inteiro }],
        refs: &[
            Ref { uid_key: "lancamento_uid", col_local: "lancamento_id", pai: "lancamento_entrada" },
            Ref { uid_key: "livro_uid", col_local: "livro_id", pai: "livro" },
        ],
    },
    // Movimento de estoque: evento append-only (DO NOTHING); FK livro por sync_uid.
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
        refs: &[Ref { uid_key: "livro_uid", col_local: "livro_id", pai: "livro" }],
    },
];

pub(crate) fn spec(recurso: &str) -> Option<&'static Spec> {
    SPECS.iter().find(|s| s.recurso == recurso)
}

/// Expressão `json_object(...)` que produz a linha no formato da nuvem
/// (booleanos 0/1→true/false; `atualizado_em` vazio→null; FKs → `*_uid`).
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
        p.push(format!("'{}',(select sync_uid from {} where id=t.{})", r.uid_key, r.pai, r.col_local));
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

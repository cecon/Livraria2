//! Casos de uso: gerenciar o cadastro de formas de pagamento (US2, FR-005..011).
//! Guards explícitos — de sistema, em uso, última ativa e nome duplicado por
//! comparação normalizada (caixa/acentos/trim — FR-010/D9, ADR-0013).

use crate::application::erros::ErroApp;
use crate::application::ports::FormaPagamentoRepo;
use crate::domain::erros::ErroDominio;
use crate::domain::pagamento::{nome_normalizado, nome_valido, FormaPagamento};

pub async fn listar(repo: &dyn FormaPagamentoRepo) -> Result<Vec<FormaPagamento>, ErroApp> {
    Ok(repo.listar().await?)
}

pub async fn listar_ativas(repo: &dyn FormaPagamentoRepo) -> Result<Vec<FormaPagamento>, ErroApp> {
    Ok(repo.listar_ativas().await?)
}

/// Já existe forma ATIVA (exceto `exceto_id`) com o mesmo nome normalizado? (FR-010)
async fn nome_conflita(
    repo: &dyn FormaPagamentoRepo,
    rotulo: &str,
    exceto_id: i64,
) -> Result<bool, ErroApp> {
    let alvo = nome_normalizado(rotulo);
    Ok(repo
        .listar()
        .await?
        .iter()
        .any(|f| f.ativa && f.id != exceto_id && nome_normalizado(&f.rotulo) == alvo))
}

/// Gera uma chave snake_case única a partir do rótulo (identidade imutável).
fn chave_de(rotulo: &str, existentes: &[FormaPagamento]) -> String {
    let base: String = nome_normalizado(rotulo)
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
        .collect::<String>()
        .split('_')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("_");
    let base = if base.is_empty() { "forma".to_string() } else { base };
    let ocupada = |c: &str| existentes.iter().any(|f| f.chave == c);
    if !ocupada(&base) {
        return base;
    }
    let mut n = 2;
    loop {
        let candidata = format!("{base}_{n}");
        if !ocupada(&candidata) {
            return candidata;
        }
        n += 1;
    }
}

/// Cria uma forma livre (FR-005). Nome obrigatório; se ativa, único entre ativas.
pub async fn criar(
    rotulo: &str,
    ativa: bool,
    repo: &dyn FormaPagamentoRepo,
) -> Result<FormaPagamento, ErroApp> {
    if !nome_valido(rotulo) {
        return Err(ErroDominio::NomeObrigatorio.into());
    }
    if ativa && nome_conflita(repo, rotulo, 0).await? {
        return Err(ErroDominio::FormaNomeDuplicado.into());
    }
    let existentes = repo.listar().await?;
    let chave = chave_de(rotulo, &existentes);
    let ordem = existentes.iter().map(|f| f.ordem).max().unwrap_or(-1) + 1;
    Ok(repo.criar(&chave, rotulo, ativa, ordem).await?)
}

/// Renomeia qualquer forma (FR-006) — a identidade (chave) não muda.
pub async fn renomear(
    id: i64,
    rotulo: &str,
    repo: &dyn FormaPagamentoRepo,
) -> Result<FormaPagamento, ErroApp> {
    if !nome_valido(rotulo) {
        return Err(ErroDominio::NomeObrigatorio.into());
    }
    let forma = repo.por_id(id).await?.ok_or(ErroDominio::FormaNaoEncontrada)?;
    if forma.ativa && nome_conflita(repo, rotulo, id).await? {
        return Err(ErroDominio::FormaNomeDuplicado.into());
    }
    repo.renomear(id, rotulo).await?;
    Ok(repo.por_id(id).await?.ok_or(ErroDominio::FormaNaoEncontrada)?)
}

/// Ativa/desativa (FR-007). Desativar: nunca de sistema nem a última ativa (FR-011).
/// Reativar: bloqueado se o nome conflita com uma ativa — renomeie antes (D9).
pub async fn definir_ativa(
    id: i64,
    ativa: bool,
    repo: &dyn FormaPagamentoRepo,
) -> Result<FormaPagamento, ErroApp> {
    let forma = repo.por_id(id).await?.ok_or(ErroDominio::FormaNaoEncontrada)?;
    if !ativa {
        if !forma.pode_desativar() {
            return Err(ErroDominio::FormaDeSistema.into());
        }
        let ativas = repo.listar_ativas().await?;
        if ativas.len() <= 1 && forma.ativa {
            return Err(ErroDominio::UltimaFormaAtiva.into());
        }
    } else if nome_conflita(repo, &forma.rotulo, id).await? {
        return Err(ErroDominio::FormaNomeDuplicado.into());
    }
    repo.definir_ativa(id, ativa).await?;
    Ok(repo.por_id(id).await?.ok_or(ErroDominio::FormaNaoEncontrada)?)
}

/// Reordena a exibição (FR-008) — não toca valores históricos.
pub async fn reordenar(
    ids: &[i64],
    repo: &dyn FormaPagamentoRepo,
) -> Result<Vec<FormaPagamento>, ErroApp> {
    repo.reordenar(ids).await?;
    Ok(repo.listar().await?)
}

/// Exclui uma forma livre nunca usada (FR-009). Em uso/de sistema → bloqueado.
pub async fn excluir(id: i64, repo: &dyn FormaPagamentoRepo) -> Result<(), ErroApp> {
    let forma = repo.por_id(id).await?.ok_or(ErroDominio::FormaNaoEncontrada)?;
    if forma.de_sistema {
        return Err(ErroDominio::FormaDeSistema.into());
    }
    if repo.em_uso(id).await? {
        return Err(ErroDominio::FormaEmUso.into());
    }
    repo.excluir(id).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chave_gerada_e_unica() {
        let f = |chave: &str| FormaPagamento {
            id: 1,
            chave: chave.into(),
            rotulo: "X".into(),
            de_sistema: false,
            ativa: true,
            ordem: 0,
        };
        assert_eq!(chave_de("PIX Igreja", &[]), "pix_igreja");
        assert_eq!(chave_de("Vale  Presente!", &[]), "vale_presente");
        assert_eq!(chave_de("Pix", &[f("pix")]), "pix_2");
        assert_eq!(chave_de("Pix", &[f("pix"), f("pix_2")]), "pix_3");
        assert_eq!(chave_de("!!!", &[]), "forma");
    }
}

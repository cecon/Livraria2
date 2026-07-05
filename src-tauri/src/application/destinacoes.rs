//! Casos de uso: cadastro de destinações (US3) e destinar estoque (US1) — ADR-0014.
//! Guards explícitos: Loja protegida, nome único normalizado entre ativas
//! (mesma regra da 005), exclusão só sem uso, transferência dentro do saldo.

use crate::application::erros::ErroApp;
use crate::application::ports_destinacao::{DestinacaoRepo, SaldoLivro, TransferenciaReg};
use crate::domain::alocacao::validar_transferencia;
use crate::domain::destinacao::{nome_normalizado, nome_valido, Destinacao};
use crate::domain::erros::ErroDominio;

pub async fn listar(repo: &dyn DestinacaoRepo) -> Result<Vec<Destinacao>, ErroApp> {
    Ok(repo.listar().await?)
}

pub async fn listar_ativas(repo: &dyn DestinacaoRepo) -> Result<Vec<Destinacao>, ErroApp> {
    Ok(repo.listar_ativas().await?)
}

/// Já existe destinação ATIVA (exceto `exceto_id`) com o mesmo nome normalizado? (FR-003)
async fn nome_conflita(
    repo: &dyn DestinacaoRepo,
    nome: &str,
    exceto_id: i64,
) -> Result<bool, ErroApp> {
    let alvo = nome_normalizado(nome);
    Ok(repo
        .listar()
        .await?
        .iter()
        .any(|d| d.ativa && d.id != exceto_id && nome_normalizado(&d.nome) == alvo))
}

async fn obter(repo: &dyn DestinacaoRepo, id: i64) -> Result<Destinacao, ErroApp> {
    Ok(repo
        .por_id(id)
        .await?
        .ok_or(ErroDominio::DestinacaoNaoEncontrada)?)
}

/// Cria uma destinação livre, ativa, no fim da ordem (FR-001).
pub async fn criar(nome: &str, repo: &dyn DestinacaoRepo) -> Result<Destinacao, ErroApp> {
    if !nome_valido(nome) {
        return Err(ErroDominio::NomeObrigatorio.into());
    }
    if nome_conflita(repo, nome, 0).await? {
        return Err(ErroDominio::DestinacaoNomeDuplicado.into());
    }
    let ordem = repo.listar().await?.iter().map(|d| d.ordem).max().unwrap_or(0) + 1;
    Ok(repo.criar(nome, &nome_normalizado(nome), ordem).await?)
}

/// Renomeia qualquer destinação — inclusive a Loja (FR-002).
pub async fn renomear(
    id: i64,
    nome: &str,
    repo: &dyn DestinacaoRepo,
) -> Result<Destinacao, ErroApp> {
    if !nome_valido(nome) {
        return Err(ErroDominio::NomeObrigatorio.into());
    }
    let d = obter(repo, id).await?;
    if d.ativa && nome_conflita(repo, nome, id).await? {
        return Err(ErroDominio::DestinacaoNomeDuplicado.into());
    }
    repo.renomear(id, nome, &nome_normalizado(nome)).await?;
    obter(repo, id).await
}

/// Ativa/desativa (FR-005). Loja nunca desativa; reativação com nome conflitante bloqueia.
pub async fn definir_ativa(
    id: i64,
    ativa: bool,
    repo: &dyn DestinacaoRepo,
) -> Result<Destinacao, ErroApp> {
    let d = obter(repo, id).await?;
    if !ativa && !d.pode_desativar() {
        return Err(ErroDominio::DestinacaoDeSistema.into());
    }
    if ativa && nome_conflita(repo, &d.nome, id).await? {
        return Err(ErroDominio::DestinacaoNomeDuplicado.into());
    }
    repo.definir_ativa(id, ativa).await?;
    obter(repo, id).await
}

/// Reordena as destinações livres (FR-001); a Loja é fixa no topo (FR-002).
pub async fn reordenar(ids: &[i64], repo: &dyn DestinacaoRepo) -> Result<Vec<Destinacao>, ErroApp> {
    for id in ids {
        if obter(repo, *id).await?.de_sistema {
            return Err(ErroDominio::DestinacaoDeSistema.into());
        }
    }
    repo.reordenar(ids).await?;
    Ok(repo.listar().await?)
}

/// Exclui destinação livre nunca usada (FR-004); usada/de sistema → erro claro.
pub async fn excluir(id: i64, repo: &dyn DestinacaoRepo) -> Result<(), ErroApp> {
    let d = obter(repo, id).await?;
    if d.de_sistema {
        return Err(ErroDominio::DestinacaoDeSistema.into());
    }
    if repo.em_uso(id).await? {
        return Err(ErroDominio::DestinacaoEmUso.into());
    }
    repo.excluir(id).await?;
    Ok(())
}

pub async fn saldos_livro(
    livro_codigo: &str,
    repo: &dyn DestinacaoRepo,
) -> Result<SaldoLivro, ErroApp> {
    Ok(repo.saldos_livro(livro_codigo).await?)
}

pub async fn historico(
    livro_codigo: &str,
    repo: &dyn DestinacaoRepo,
) -> Result<Vec<TransferenciaReg>, ErroApp> {
    Ok(repo.transferencias_livro(livro_codigo).await?)
}

/// Destinar estoque (US1, FR-006): move `qtd` entre livre e carimbos.
/// Guards: origem ≠ destino, destino existente e ativo, saldo suficiente na origem.
pub async fn transferir(
    livro_codigo: &str,
    de: Option<i64>,
    para: Option<i64>,
    qtd: i64,
    motivo: Option<String>,
    repo: &dyn DestinacaoRepo,
) -> Result<SaldoLivro, ErroApp> {
    if de == para {
        return Err(ErroDominio::TransferenciaInvalida.into());
    }
    if let Some(id) = para {
        let destino = obter(repo, id).await?;
        if !destino.ativa {
            return Err(ErroDominio::DestinacaoInativa.into());
        }
    }
    if let Some(id) = de {
        obter(repo, id).await?; // origem pode estar inativa (drenar saldo)
    }
    let saldos = repo.saldos_livro(livro_codigo).await?;
    let origem_saldo = match de {
        None => saldos.livre,
        Some(id) => saldos
            .carimbos
            .iter()
            .find(|c| c.destinacao_id == id)
            .map(|c| c.qtd)
            .unwrap_or(0),
    };
    validar_transferencia(origem_saldo, qtd)?;
    Ok(repo.transferir(livro_codigo, de, para, qtd, motivo).await?)
}

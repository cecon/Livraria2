//! Caso de uso do turno de operação (feature 009, ADR-0021). Orquestra a porta
//! `TurnoRepo` + o domínio puro `turno_operacao` (mesma regra do Escritório/WASM).

use crate::application::erros::ErroApp;
use crate::application::ports_turno::{MovimentoCaixaInfo, TurnoAbertoInfo, TurnoHistorico, TurnoRepo};
use crate::domain::dinheiro::Dinheiro;
use crate::domain::erros::ErroDominio;
use crate::domain::turno_operacao;

/// Turno aberto do operador (ou `None`).
pub async fn turno_aberto(repo: &dyn TurnoRepo, operador: &str) -> Result<Option<TurnoAbertoInfo>, ErroApp> {
    Ok(repo.turno_aberto(operador).await?)
}

/// Abre um turno. Bloqueia se já houver um aberto do operador nesta origem (D7).
pub async fn abrir(repo: &dyn TurnoRepo, operador: &str, caixa_inicial_centavos: i64) -> Result<TurnoAbertoInfo, ErroApp> {
    if caixa_inicial_centavos < 0 {
        return Err(ErroDominio::DadosInvalidos("caixa inicial nao pode ser negativo".into()).into());
    }
    if repo.turno_aberto(operador).await?.is_some() {
        return Err(ErroApp::Dominio(ErroDominio::TurnoJaAberto));
    }
    Ok(repo.abrir(operador, caixa_inicial_centavos).await?)
}

/// Próximo Pedido Nº do turno (1..n) — regra pura do domínio.
pub async fn proximo_numero_no_turno(repo: &dyn TurnoRepo, turno_uid: &str) -> Result<i64, ErroApp> {
    let qtd = repo.contar_pedidos(turno_uid).await?;
    Ok(turno_operacao::proximo_numero(qtd))
}

/// Resumo do fechamento (esperado só-dinheiro + totais por forma), sem encerrar.
pub struct ResumoFechamento {
    pub qtd_vendas: i64,
    pub por_forma: Vec<(i64, i64)>,
    pub esperado_dinheiro_centavos: i64,
    pub suprimentos_centavos: i64,
    pub sangrias_centavos: i64,
}

pub async fn resumo(repo: &dyn TurnoRepo, turno_uid: &str) -> Result<ResumoFechamento, ErroApp> {
    let dados = repo.dados_fechamento(turno_uid).await?;
    let dinheiro_id = repo.dinheiro_forma_id().await?;
    let r = turno_operacao::resumir_fechamento(
        &dados.pagamentos,
        Dinheiro::de_centavos(dados.caixa_inicial_centavos),
        dinheiro_id,
        dados.qtd_vendas,
    );
    Ok(ResumoFechamento {
        qtd_vendas: r.qtd_vendas,
        por_forma: r.por_forma.into_iter().map(|(id, d)| (id, d.centavos())).collect(),
        esperado_dinheiro_centavos: turno_operacao::esperado_com_movimentos(
            r.esperado_dinheiro,
            Dinheiro::de_centavos(dados.suprimentos_centavos),
            Dinheiro::de_centavos(dados.sangrias_centavos),
        ).centavos(),
        suprimentos_centavos: dados.suprimentos_centavos,
        sangrias_centavos: dados.sangrias_centavos,
    })
}

/// Encerra o turno: computa o fechamento (esperado × conferido) e persiste.
pub struct Fechamento {
    pub esperado_centavos: i64,
    pub conferido_centavos: i64,
    pub diferenca_centavos: i64,
}

pub async fn encerrar(repo: &dyn TurnoRepo, turno_uid: &str, conferido_centavos: i64) -> Result<Fechamento, ErroApp> {
    if conferido_centavos < 0 {
        return Err(ErroDominio::DadosInvalidos("dinheiro conferido nao pode ser negativo".into()).into());
    }
    let r = resumo(repo, turno_uid).await?;
    let f = turno_operacao::encerrar(
        Dinheiro::de_centavos(r.esperado_dinheiro_centavos),
        Dinheiro::de_centavos(conferido_centavos),
    );
    repo.encerrar(turno_uid, f.esperado.centavos(), f.conferido.centavos(), f.diferenca).await?;
    Ok(Fechamento {
        esperado_centavos: f.esperado.centavos(),
        conferido_centavos: f.conferido.centavos(),
        diferenca_centavos: f.diferenca,
    })
}

/// Histórico de turnos do operador.
pub async fn listar(repo: &dyn TurnoRepo, operador: &str) -> Result<Vec<TurnoHistorico>, ErroApp> {
    Ok(repo.listar(operador).await?)
}

pub async fn registrar_movimento(repo: &dyn TurnoRepo, turno_uid: &str, operador: &str,
    tipo: &str, valor_centavos: i64, motivo: &str) -> Result<(), ErroApp> {
    if !matches!(tipo, "sangria" | "suprimento") || valor_centavos <= 0 || motivo.trim().is_empty() {
        return Err(ErroDominio::DadosInvalidos("informe tipo, valor positivo e motivo".into()).into());
    }
    repo.registrar_movimento(turno_uid, operador, tipo, valor_centavos, motivo.trim()).await?;
    Ok(())
}

pub async fn listar_movimentos(repo: &dyn TurnoRepo, turno_uid: &str) -> Result<Vec<MovimentoCaixaInfo>, ErroApp> {
    Ok(repo.listar_movimentos(turno_uid).await?)
}

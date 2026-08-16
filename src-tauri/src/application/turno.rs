//! Caso de uso do turno de operação (feature 009, ADR-0021). Orquestra a porta
//! `TurnoRepo` + o domínio puro `turno_operacao` (mesma regra do Escritório/WASM).

use crate::application::erros::ErroApp;
use crate::application::ports::{Maquina, VendaTurno};
use crate::application::ports_turno::{TurnoAbertoInfo, TurnoHistorico, TurnoRepo};
use crate::domain::dinheiro::Dinheiro;
use crate::domain::erros::ErroDominio;
use crate::domain::turno_operacao;

/// Adota, no boot, o turno que já estava aberto quando a máquina passou a fazer
/// parte da identidade (m014) — o operador continua nele em vez de ter o caixa do
/// dia partido em dois. Turnos do Escritório ficam de fora (o adapter filtra por
/// `origem = 'pdv'`). **Premissa operacional: um PDV por loja** — com dois PDVs, o
/// turno aberto do outro também desce pela réplica sem `maquina` e seria carimbado
/// aqui. Antes de instalar um 2º PDV, troque isto por adoção confirmada pelo
/// operador. Idempotente: só age em turno aberto sem máquina.
pub async fn adotar_turnos_legados(repo: &dyn TurnoRepo, maquina: &dyn Maquina) -> Result<u64, ErroApp> {
    Ok(repo.adotar_turnos_sem_maquina(&maquina.nome()).await?)
}

/// Turno aberto **desta máquina** (ou `None`) — FR-017.
pub async fn aberto(repo: &dyn TurnoRepo, maquina: &dyn Maquina) -> Result<Option<TurnoAbertoInfo>, ErroApp> {
    Ok(repo.turno_aberto_na_maquina(&maquina.nome()).await?)
}

/// Abre um turno **ou continua no que já está aberto** nesta máquina (FR-002/FR-017):
/// havendo um aberto, quem loga entra nele; só se não houver é que um novo nasce.
pub async fn abrir_ou_continuar(
    repo: &dyn TurnoRepo,
    maquina: &dyn Maquina,
    operador: &str,
    caixa_inicial_centavos: i64,
) -> Result<TurnoAbertoInfo, ErroApp> {
    let nome = maquina.nome();
    let existente = repo.turno_aberto_na_maquina(&nome).await?;
    if !turno_operacao::pode_abrir(existente.is_some()) {
        // Domínio recusou o 2º turno: o operador continua no que está aberto.
        return existente.ok_or(ErroApp::Dominio(ErroDominio::TurnoJaAberto));
    }
    Ok(repo.abrir(operador, caixa_inicial_centavos, &nome).await?)
}

/// Turno da venda: exige um turno aberto nesta máquina (FR-002) e resolve o
/// Pedido Nº dentro dele (FR-016). Sem turno aberto → `VendaSemTurno`.
pub async fn contexto_venda(repo: &dyn TurnoRepo, maquina: &dyn Maquina) -> Result<VendaTurno, ErroApp> {
    let turno = aberto(repo, maquina)
        .await?
        .ok_or(ErroApp::Dominio(ErroDominio::VendaSemTurno))?;
    // O repo só devolve turno `aberto`; a guarda pura mantém a regra explícita.
    if !turno_operacao::pode_registrar_venda(turno_operacao::StatusTurno::Aberto) {
        return Err(ErroApp::Dominio(ErroDominio::VendaSemTurno));
    }
    Ok(VendaTurno {
        numero_no_turno: proximo_numero_no_turno(repo, &turno.sync_uid).await?,
        uid: turno.sync_uid,
    })
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
        esperado_dinheiro_centavos: r.esperado_dinheiro.centavos(),
    })
}

/// Encerra o turno: computa o fechamento (esperado × conferido) e persiste.
pub struct Fechamento {
    pub esperado_centavos: i64,
    pub conferido_centavos: i64,
    pub diferenca_centavos: i64,
}

pub async fn encerrar(repo: &dyn TurnoRepo, turno_uid: &str, conferido_centavos: i64) -> Result<Fechamento, ErroApp> {
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

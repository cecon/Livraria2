//! Caso de uso: retenção local de 45 dias (feature 013, US3 — FR-007/008/011a).
//!
//! O PDV guarda só os turnos recentes; **a nuvem retém tudo**. Por isso a poda
//! só alcança turno encerrado cujo cluster inteiro já subiu — nada que ainda não
//! chegou lá é apagado aqui. A unidade é o TURNO (clarify da spec): some o turno
//! com todas as suas vendas, nunca uma venda solta.
//!
//! Não é estorno: `livro`, `saldo_publicado` e o razão de movimentos ficam
//! intactos. Poda é esquecer o detalhe antigo, não desfazer o que aconteceu.

use crate::application::erros::ErroApp;
use crate::application::ports::Relogio;
use crate::application::ports_turno::TurnoRepo;
use crate::domain::turno_operacao::{turno_podavel, StatusTurno, RETENCAO_DIAS};

/// Resultado da poda — vira log no boot/pós-sync, não bloqueia a UI.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct ResumoPoda {
    pub turnos: usize,
    pub linhas: u64,
}

/// Poda os turnos encerrados, já sincronizados e com mais de 45 dias.
/// Idempotente: rodar de novo não encontra mais nada para apagar.
pub async fn podar(repo: &dyn TurnoRepo, relogio: &dyn Relogio) -> Result<ResumoPoda, ErroApp> {
    let hoje = relogio.hoje_iso();
    let mut resumo = ResumoPoda::default();
    for t in repo.turnos_podaveis().await? {
        // A idade é decisão do domínio (mesma regra do Escritório via WASM).
        if !turno_podavel(StatusTurno::de_str(&t.status), &t.abertura, &hoje, RETENCAO_DIAS) {
            continue;
        }
        resumo.linhas += repo.podar_turno(&t.sync_uid).await?;
        resumo.turnos += 1;
    }
    Ok(resumo)
}

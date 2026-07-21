//! Caso de uso da sincronização (feature 007, ADR-0015/0016).
//!
//! Orquestra, de forma idempotente e retomável: **push** dos pendentes (ordem
//! pais→filhas) → **pull** desde o cursor → **recomputa derivados** dos livros
//! afetados. Usa as portas [`NuvemRepo`] e [`ReplicaLocalRepo`] + o domínio.

use crate::application::ports::RepoErro;
use crate::application::ports_sync::{NuvemRepo, ReplicaLocalRepo};
use crate::domain::sincronizacao::ORDEM_DEPENDENCIA;
use std::collections::HashSet;

/// Resumo de uma sincronização (para o comando/indicador de estado — FR-014).
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ResumoSync {
    pub enviados: usize,
    pub recebidos: usize,
    pub orfas: usize,
}

/// Executa uma sincronização completa. Retomável: falha de rede em qualquer passo
/// é segura (upsert por `sync_uid` não duplica; o cursor só avança após aplicar).
pub async fn sincronizar(
    nuvem: &dyn NuvemRepo,
    local: &dyn ReplicaLocalRepo,
) -> Result<ResumoSync, RepoErro> {
    let agora = nuvem.agora_servidor().await?;
    let mut resumo = ResumoSync::default();

    // 1) PUSH dos pendentes, pais→filhas (respeita FKs na nuvem).
    resumo.enviados = enviar_pendentes(nuvem, local, &agora).await?;

    // 2) PULL desde o cursor, pais→filhas (respeita FKs locais).
    let mut livros_afetados: HashSet<String> = HashSet::new();
    for recurso in ORDEM_DEPENDENCIA {
        let cursor = local.cursor(recurso).await?;
        let lote = nuvem.buscar_desde(recurso, &cursor).await?;
        if lote.registros.is_empty() {
            continue;
        }
        local.aplicar(recurso, &lote.registros).await?;
        resumo.recebidos += lote.registros.len();
        if *recurso == "movimento_estoque" {
            for r in &lote.registros {
                if let Some(u) = r.dados.get("livro_uid").and_then(|v| v.as_str()) {
                    livros_afetados.insert(u.to_string());
                }
            }
        }
        local.salvar_cursor(recurso, &lote.novo_cursor).await?;
    }

    // 3) Recomputa derivados (saldo, custo_medio) dos livros que receberam movimentos.
    if !livros_afetados.is_empty() {
        let alvo: Vec<String> = livros_afetados.into_iter().collect();
        local.recomputar_derivados(&alvo).await?;
    }

    Ok(resumo)
}

/// Empurra todos os pendentes (pais→filhas), marcando-os sincronizados. Retorna
/// quantos foram enviados. Usado pelo sync e pela carga inicial (`semear`).
async fn enviar_pendentes(
    nuvem: &dyn NuvemRepo,
    local: &dyn ReplicaLocalRepo,
    agora: &str,
) -> Result<usize, RepoErro> {
    let mut enviados = 0;
    for recurso in ORDEM_DEPENDENCIA {
        let pendentes = local.pendentes(recurso).await?;
        if pendentes.is_empty() {
            continue;
        }
        nuvem.upsert(recurso, &pendentes).await?;
        let uids: Vec<String> = pendentes.iter().map(|r| r.sync_uid.clone()).collect();
        local.marcar_sincronizado(recurso, &uids, agora).await?;
        enviados += pendentes.len();
    }
    Ok(enviados)
}

/// Carga inicial (T028/D13): sobe **todo o histórico pendente** para a nuvem, de
/// forma idempotente (upsert por `sync_uid`). É só o push — o pull vem no sync normal.
pub async fn semear(nuvem: &dyn NuvemRepo, local: &dyn ReplicaLocalRepo) -> Result<usize, RepoErro> {
    let agora = nuvem.agora_servidor().await?;
    enviar_pendentes(nuvem, local, &agora).await
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::application::ports_sync::{LotePull, RegistroSync};
    use async_trait::async_trait;
    use serde_json::json;
    use std::sync::Mutex;

    fn reg(recurso: &str, uid: &str) -> RegistroSync {
        RegistroSync {
            recurso: recurso.to_string(),
            sync_uid: uid.to_string(),
            atualizado_em: Some("2026-07-20T10:00:00Z".into()),
            excluido_em: None,
            dados: json!({"sync_uid": uid}),
        }
    }

    #[derive(Default)]
    struct FakeNuvem {
        recebidos: Mutex<Vec<(String, usize)>>, // (recurso, qtd) upserts
        pull: Mutex<std::collections::HashMap<String, Vec<RegistroSync>>>,
    }
    #[async_trait]
    impl NuvemRepo for FakeNuvem {
        async fn upsert(&self, recurso: &str, registros: &[RegistroSync]) -> Result<(), RepoErro> {
            self.recebidos.lock().unwrap().push((recurso.into(), registros.len()));
            Ok(())
        }
        async fn buscar_desde(&self, recurso: &str, _cursor: &str) -> Result<LotePull, RepoErro> {
            let regs = self.pull.lock().unwrap().remove(recurso).unwrap_or_default();
            let cursor = regs.last().map(|_| "2026-07-20T11:00:00Z".to_string()).unwrap_or_default();
            Ok(LotePull { registros: regs, novo_cursor: cursor })
        }
        async fn agora_servidor(&self) -> Result<String, RepoErro> {
            Ok("2026-07-20T12:00:00Z".into())
        }
    }

    #[derive(Default)]
    struct FakeLocal {
        pendentes: Mutex<std::collections::HashMap<String, Vec<RegistroSync>>>,
        marcados: Mutex<Vec<String>>,
        aplicados: Mutex<Vec<String>>,
        recomputados: Mutex<Vec<String>>,
    }
    #[async_trait]
    impl ReplicaLocalRepo for FakeLocal {
        async fn pendentes(&self, recurso: &str) -> Result<Vec<RegistroSync>, RepoErro> {
            Ok(self.pendentes.lock().unwrap().get(recurso).cloned().unwrap_or_default())
        }
        async fn marcar_sincronizado(&self, recurso: &str, uids: &[String], _q: &str) -> Result<(), RepoErro> {
            // "consome" os pendentes ao marcar (idempotência da 2ª rodada).
            self.pendentes.lock().unwrap().remove(recurso);
            for u in uids { self.marcados.lock().unwrap().push(u.clone()); }
            Ok(())
        }
        async fn aplicar(&self, _r: &str, registros: &[RegistroSync]) -> Result<(), RepoErro> {
            for r in registros { self.aplicados.lock().unwrap().push(r.sync_uid.clone()); }
            Ok(())
        }
        async fn uids_conhecidos(&self, _r: &str) -> Result<HashSet<String>, RepoErro> {
            Ok(HashSet::new())
        }
        async fn cursor(&self, _r: &str) -> Result<String, RepoErro> { Ok(String::new()) }
        async fn salvar_cursor(&self, _r: &str, _c: &str) -> Result<(), RepoErro> { Ok(()) }
        async fn recomputar_derivados(&self, livros: &[String]) -> Result<(), RepoErro> {
            for l in livros { self.recomputados.lock().unwrap().push(l.clone()); }
            Ok(())
        }
    }

    #[tokio::test]
    async fn push_envia_pendentes_e_pull_aplica_e_recomputa() {
        let nuvem = FakeNuvem::default();
        nuvem.pull.lock().unwrap().insert(
            "movimento_estoque".into(),
            vec![RegistroSync { dados: json!({"sync_uid":"m1","livro_uid":"L1"}), ..reg("movimento_estoque","m1") }],
        );
        let local = FakeLocal::default();
        local.pendentes.lock().unwrap().insert("livro".into(), vec![reg("livro", "L1")]);

        let r = sincronizar(&nuvem, &local).await.unwrap();
        assert_eq!(r.enviados, 1); // livro pendente empurrado
        assert_eq!(r.recebidos, 1); // movimento puxado
        assert_eq!(local.aplicados.lock().unwrap().as_slice(), &["m1".to_string()]);
        // livro afetado recomputado
        assert_eq!(local.recomputados.lock().unwrap().as_slice(), &["L1".to_string()]);
    }

    #[tokio::test]
    async fn segunda_rodada_sem_novidades_e_noop() {
        let nuvem = FakeNuvem::default();
        let local = FakeLocal::default(); // nada pendente, nada a puxar
        let r = sincronizar(&nuvem, &local).await.unwrap();
        assert_eq!(r, ResumoSync::default()); // 0/0/0 — idempotente
        assert!(nuvem.recebidos.lock().unwrap().is_empty());
    }
}

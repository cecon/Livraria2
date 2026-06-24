//! Caso de uso: registrar entrada de mercadoria (compra) — US1, FR-010..015.
//! Deriva o custo (total↔unitário) e delega a persistência atômica ao EstoqueRepo.

use crate::application::erros::ErroApp;
use crate::application::ports_estoque::{EntradaCmd, EstoqueRepo};
use crate::domain::estoque::derivar_custos;
use crate::domain::livro::Livro;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntradaInput {
    pub codigo: String,
    pub qtd: i64,
    #[serde(default)]
    pub fornecedor: String,
    pub custo_total_centavos: Option<i64>,
    pub custo_unit_centavos: Option<i64>,
}

/// Registra a entrada: valida qtd/custo (domínio) e persiste, recalculando o custo médio.
pub async fn registrar_entrada(
    input: EntradaInput,
    estoque: &dyn EstoqueRepo,
) -> Result<Livro, ErroApp> {
    // derivar_custos valida `qtd > 0` e exige um dos custos (FR-010a/FR-014).
    let (unit, _total) = derivar_custos(
        input.custo_total_centavos,
        input.custo_unit_centavos,
        input.qtd,
    )?;
    let cmd = EntradaCmd {
        livro_codigo: input.codigo,
        qtd: input.qtd,
        custo_unit_centavos: unit,
        fornecedor: input.fornecedor.trim().to_string(),
    };
    Ok(estoque.registrar_entrada(cmd).await?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::application::ports::RepoErro;
    use crate::application::ports_estoque::MovimentoView;
    use crate::domain::categoria::Categoria;
    use crate::domain::dinheiro::Dinheiro;
    use async_trait::async_trait;
    use std::sync::Mutex;

    #[derive(Default)]
    struct FakeEstoque {
        ultimo: Mutex<Option<EntradaCmd>>,
    }

    fn livro_preco_fixo() -> Livro {
        Livro {
            codigo: "111".into(),
            titulo: "Bíblia".into(),
            autor: None,
            preco: Dinheiro::de_centavos(5000),
            categoria: Categoria::Biblias,
            estoque: 14,
            descricao: None,
            codigo_barras: None,
            custo_medio: Dinheiro::de_centavos(893),
        }
    }

    #[async_trait]
    impl EstoqueRepo for FakeEstoque {
        async fn registrar_entrada(&self, cmd: EntradaCmd) -> Result<Livro, RepoErro> {
            *self.ultimo.lock().unwrap() = Some(cmd);
            Ok(livro_preco_fixo())
        }
        async fn registrar_ajuste(&self, _c: &str, _d: i64, _m: &str) -> Result<Livro, RepoErro> {
            unreachable!()
        }
        async fn extrato(&self, _c: &str, _l: i64) -> Result<Vec<MovimentoView>, RepoErro> {
            Ok(vec![])
        }
        async fn gerar_saldos_iniciais(&self) -> Result<u64, RepoErro> {
            Ok(0)
        }
        async fn fornecedores_sugestoes(&self, _p: &str, _l: i64) -> Result<Vec<String>, RepoErro> {
            Ok(vec![])
        }
    }

    fn input(qtd: i64, total: Option<i64>, unit: Option<i64>) -> EntradaInput {
        EntradaInput {
            codigo: "111".into(),
            qtd,
            fornecedor: " Editora X ".into(),
            custo_total_centavos: total,
            custo_unit_centavos: unit,
        }
    }

    #[tokio::test]
    async fn qtd_invalida_barra() {
        let fake = FakeEstoque::default();
        let r = registrar_entrada(input(0, None, Some(1250)), &fake).await;
        assert!(r.is_err());
    }

    #[tokio::test]
    async fn deriva_unitario_do_total() {
        let fake = FakeEstoque::default();
        registrar_entrada(input(10, Some(12500), None), &fake)
            .await
            .unwrap();
        let cmd = fake.ultimo.lock().unwrap().take().unwrap();
        assert_eq!(cmd.custo_unit_centavos, 1250);
        assert_eq!(cmd.fornecedor, "Editora X"); // trim aplicado
    }

    #[tokio::test]
    async fn nao_altera_preco_de_venda() {
        // FR-013: a entrada lida só com estoque/custo; o preço de venda do livro
        // retornado permanece o que estava (5000), não é tocado pelo fluxo de entrada.
        let fake = FakeEstoque::default();
        let l = registrar_entrada(input(5, None, Some(900)), &fake)
            .await
            .unwrap();
        assert_eq!(l.preco.centavos(), 5000);
    }
}

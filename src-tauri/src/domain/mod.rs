//! Camada de domínio (Hexagonal — ADR-0002): regras puras, sem UI, sem banco.
//! Nenhum módulo aqui depende de Tauri, SeaORM ou I/O.

pub mod alocacao;
pub mod categoria;
pub mod destinacao;
pub mod dinheiro;
pub mod erros;
pub mod estoque;
pub mod fornecedor;
pub mod inventario;
pub mod lancamento;
pub mod livro;
pub mod pagamento;
pub mod pedido;
pub mod sincronizacao;
pub mod texto;

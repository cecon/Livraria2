//! Camada de domínio (Hexagonal — ADR-0002): regras puras, sem UI, sem banco.
//! Nenhum módulo aqui depende de Tauri, SeaORM ou I/O.

pub mod categoria;
pub mod dinheiro;
pub mod erros;
pub mod estoque;
pub mod inventario;
pub mod livro;
pub mod pagamento;
pub mod pedido;
pub mod texto;

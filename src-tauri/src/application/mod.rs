//! Camada de aplicação (Hexagonal): portas e casos de uso.
//! Orquestra o domínio e fala com o mundo externo apenas por meio das portas.

pub mod cadastro;
pub mod erros;
pub mod migracao;
pub mod ports;
pub mod venda;

//! Adapters (Hexagonal, borda): implementam as portas e falam com o mundo externo.
//! Persistência (SeaORM), relógio, sincronização com a nuvem.

pub mod maquina;
pub mod nuvem;
pub mod persistencia;
pub mod relogio;

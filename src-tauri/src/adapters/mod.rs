//! Adapters (Hexagonal, borda): implementam as portas e falam com o mundo externo.
//! Persistência (SeaORM), relógio, importador do legado (próximos incrementos).

pub mod legado;
pub mod nuvem;
pub mod persistencia;
pub mod relogio;

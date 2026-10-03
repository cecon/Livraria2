//! Acesso exclusivo à API da nuvem.
//! Implementa `NuvemRepo` sobre HTTPS. Só I/O remoto; não conhece o SQLite local.

pub mod api_sync;
pub mod produtos;
pub mod diagnostico;

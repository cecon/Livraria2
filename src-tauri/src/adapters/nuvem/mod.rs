//! Adapter da nuvem (Supabase/PostgREST) — feature 007 (ADR-0015/0016).
//! Implementa `NuvemRepo` sobre HTTPS. Só I/O remoto; não conhece o SQLite local.

pub mod supabase_sync;

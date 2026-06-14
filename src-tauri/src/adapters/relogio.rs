//! Adapter do relógio do sistema (implementa a porta `Relogio`).
//! `chrono` fica isolado aqui — o domínio só recebe `u32`/`String` (ADR-0002).

use crate::application::ports::Relogio;
use chrono::{Datelike, Local, Timelike};

pub struct RelogioSistema;

impl Relogio for RelogioSistema {
    fn hora_atual(&self) -> u32 {
        Local::now().hour()
    }

    fn hoje_iso(&self) -> String {
        let hoje = Local::now();
        format!("{:04}-{:02}-{:02}", hoje.year(), hoje.month(), hoje.day())
    }
}

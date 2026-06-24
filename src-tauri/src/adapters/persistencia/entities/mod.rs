//! Entidades SeaORM (uma por tabela). Vivem no adapter, nunca no domínio (ADR-0003).

pub mod item_contagem;
pub mod item_pedido;
pub mod livro;
pub mod movimento_estoque;
pub mod pedido;
pub mod pendencia_cadastro;
pub mod sessao_inventario;
pub mod usuario;

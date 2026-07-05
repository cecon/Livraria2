//! Camada de aplicação (Hexagonal): portas e casos de uso.
//! Orquestra o domínio e fala com o mundo externo apenas por meio das portas.

pub mod ajuste;
pub mod cadastro;
pub mod dashboard;
pub mod erros;
pub mod estoque_setup;
pub mod extrato;
pub mod formas_pagamento;
pub mod fornecedores;
pub mod lancamentos;
pub mod migracao;
pub mod pesquisa;
pub mod inventario;
pub mod destinacoes;
pub mod ports;
pub mod ports_compras;
pub mod ports_destinacao;
pub mod ports_estoque;
pub mod ports_inventario;
pub mod relatorios;
pub mod venda;

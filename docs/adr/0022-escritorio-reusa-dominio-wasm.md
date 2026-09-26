# ADR-0022: dominio Rust em WebAssembly

`crates/livraria-domain` contem calculos puros, usados pelo PDV nativo.
`crates/livraria-domain-wasm` produz `packages/domain`, consumido pela web.
Isso nao compartilha interface: cada aplicacao possui seus componentes e estilos.

Vetores de conformidade nativa e WASM ficam em `crates/livraria-domain/tests`.
O JavaScript em `packages/domain/index.js` e gerado pelo wasm-bindgen, sem edicao manual.

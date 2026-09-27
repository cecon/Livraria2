# ADR-0033: binding WASM gerado no verificador de tamanho

Status: aceito. Data: 2026-09-26.

`packages/domain/index.js` e produzido pelo wasm-bindgen a partir de
`crates/livraria-domain-wasm`. Nao contem logica escrita manualmente.
Dividir o arquivo gerado seria perdido na proxima compilacao e poderia quebrar
as ligacoes com o binario WASM.

O verificador exclui somente esse caminho do limite de 300 linhas.
Fontes Rust, wrappers TypeScript e demais arquivos continuam sujeitos ao limite.
A integridade funcional e verificada pelos vetores de conformidade nativa/WASM.

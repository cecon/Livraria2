# ADR-0019: identidade de usuario

Usuarios sao administrados no Cloud. A API autentica a pessoa e verifica o perfil
em cada operacao protegida. Cada PDV possui identidade de dispositivo propria.

O PDV recebe os operadores e hashes pelo endpoint autenticado de referencias
para permitir verificacao offline. Credenciais nao sao registradas em logs.
Fluxo atual: [ADR-0032](0032-interfaces-independentes-api-unica.md).

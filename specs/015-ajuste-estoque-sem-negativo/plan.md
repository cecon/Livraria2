# Implementation Plan: Ajuste manual de estoque sem saldo negativo

**Branch**: `015-ajuste-estoque-sem-negativo` | **Date**: 2026-10-16 | **Spec**: [spec.md](spec.md)

## Summary

Porta da antiga 014 só o delta que a main não tem. API (`apps/nuvem/api`): em
`StockService.persist`, para `tipo='ajuste'`, ler o saldo oficial do livro **dentro da transação que
já trava `movimento_estoque`** e recusar (409) ajuste negativo que leve o saldo abaixo de zero.
Retaguarda (`apps/nuvem/retaguarda`): `AjusteEstoque` passa a ler quantidade inteira exata, trava
envio duplo e avisa o pai para recarregar o saldo após uma recusa.

## Technical Context

**Language/Version**: TypeScript (NestJS + Prisma na API; Next.js/React na retaguarda)
**Storage**: PostgreSQL oficial — sem migração, sem trigger
**Testing**: `node --test` integração da API (`tests/admin-stock.cjs`, Postgres em Docker como no CI
`nuvem-api.yml`); `vitest` da retaguarda (`npm run test:api -w livraria-escritorio`)
**Constraints**: ≤ 300 linhas por arquivo; mensagens pt-BR; sem tocar vendas/inventário

## Constitution Check (v3.1.2)

- **I — Dois produtos**: ✅ mudança só no Cloud (API + retaguarda); PDV intocado.
- **II — Autoridade da nuvem**: ✅ regra aplicada na API, que é a autoridade do estoque oficial.
- **III — Integridade/reenvio**: ✅ reenvio do mesmo `sync_uid` segue idempotente e não é reavaliado.
- **IV — Estoque**: ✅ vendas continuam podendo gerar saldo negativo; só o ajuste manual negativo é
  limitado; ajuste positivo sempre aceito; inventário intocado.
- **V — Permissões**: ✅ mesma rota e permissão (`POST /admin/estoque/ajustes`).

## Project Structure

```text
apps/nuvem/api/src/admin/stock.service.ts      # checagem de saldo no persist (ajuste)
apps/nuvem/api/tests/admin-stock.cjs           # casos: recusa, zera, positivo com saldo negativo, retry
apps/nuvem/retaguarda/lib/nuvem/ajuste.ts      # NOVO: lerQtdAjuste (puro)
apps/nuvem/retaguarda/lib/nuvem/__tests__/ajuste.test.ts
apps/nuvem/retaguarda/components/AjusteEstoque.tsx   # qtd exata, trava de envio, onRecusado
apps/nuvem/retaguarda/app/cadastro/LivroForm.tsx     # onRecusado → recarregarSaldo
apps/nuvem/retaguarda/app/pesquisa/page.tsx          # onRecusado → carregarBase
```

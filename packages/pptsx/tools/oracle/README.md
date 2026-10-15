# Oráculo do browser (dev-only, opcional)

Gera `tests/layout/__fixtures__/css-cases.json`: os frames que um Chromium real calcula para cada caso de `tests/layout/__fixtures__/css-cases.ts` (grid, wrap, margin auto, block, bordas, herança). Os testes (`tests/layout/oracle.test.tsx`) comparam o motor da engine com essas fixtures **sem abrir browser**; só quem muda os casos precisa regerar.

```sh
npm i -D playwright-core          # não é dependência do pacote; instale só para regerar
npx playwright-core install chromium   # ou use o Chrome local: ver generate.ts (channel)
npm run oracle:generate
```

Origem: PoC `docs/work/poc/browser-layout.md` §9.

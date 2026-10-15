# pptsx — monorepo

TSX → PPTX com layout automático (CSS de verdade: flex, grid, margens, bordas) e arquivo nativo editável no PowerPoint e no Keynote.

| pacote | o que é |
|---|---|
| [`pptsx`](packages/pptsx/README.md) | o núcleo: primitivas, layout, ajuste, diagnósticos, emissão PPTX, preview, CLI (`build`, `init`, `preview --serve`, `lint`), servidor MCP e os ganchos para design systems |
| [`@pptsx/ds-kit`](packages/ds-kit/README.md) | ferramentas para criar um design system em cima do núcleo: tokens, tema, variantes, slots, regras de lint, catálogo, `createDs` |
| [`@pptsx/ds-base`](packages/ds-base/README.md) | um design system de exemplo: tokens, tema, layouts, componentes, regras de marca e a galeria |

Como o React é a base de bibliotecas de componentes, o pptsx é a base de design systems: **o núcleo faz render e não tem marca**; tokens, tema, layouts e componentes vivem num DS, que se liga ao núcleo pela API pública (`defineComponent`, regras de lint, `renderFragment`, `defineDs`).

## Desenvolvimento

```bash
npm install
```

```bash
npm test
```

```bash
npm run typecheck
```

`npm test`, `npm run typecheck`, `npm run build` e `npm run test:package` rodam em todos os pacotes. Documentos de trabalho (spec, marcos, contratos, relatórios) ficam em [`docs/`](docs/).

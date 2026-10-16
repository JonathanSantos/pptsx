<p align="center">
  <img src="../../packages/pptsx/docs/readme/gallery-ds/hero.png" width="100%" alt="As capas dos seis design systems em 3 por 2: Nebula, A Gazeta, FORMA, Brisa, terminal e Botânica">
</p>

# Galeria: seis design systems

Seis design systems criados do zero com o [`@pptsx/ds-kit`](../../packages/ds-kit/README.md), só com a API pública de `pptsx` e do kit. São as imagens da galeria dos READMEs. Cada pasta é um DS pequeno e completo:

| arquivo | o que tem |
|---|---|
| `tokens.ts` | `defineTokens` (cores, escala tipográfica, espaços) e o tema do arquivo com `themeOf` |
| `components.tsx` | os componentes do DS, com `defineComponent` e variantes por `createVariants` |
| `deck.tsx` | um deck de quatro slides que usa o DS |
| `pptsx.config.ts` | as fontes registradas |
| `tsconfig.json` | estende o `tsconfig.monorepo.json` (importa `pptsx` e `@pptsx/ds-kit` de `src/`) |

| pasta | DS | fontes | assinatura |
|---|---|---|---|
| [`nebula/`](nebula/) | lançamento de produto | Inter, Andale Mono | brilhos em elipses com `opacity`, anéis de `border`, barras de `Box` em % |
| [`gazeta/`](gazeta/) | editorial de jornal | Georgia, Inter | fios de diagramação com bordas, capitular, tabela e gráfico nativos em Georgia |
| [`forma/`](forma/) | congresso de design (Bauhaus) | DIN Condensed, Inter | composição de `Shape` absolutos, retratos geométricos, mosaico com `span` |
| [`brisa/`](brisa/) | app de finanças | Inter | pastéis, `boxShadow` macia, rosca nativa, barras de progresso |
| [`terminal/`](terminal/) | pós-mortem de incidente | Andale Mono | janela de terminal, trilho tracejado, gráfico de área nativo |
| [`botanica/`](botanica/) | relatório de impacto | Big Caslon, Inter | folhas em elipses com `rotate`, paisagens de elipses, barras empilhadas |

## Regenerar a galeria

Na raiz do monorepo:

```bash
node scripts/gallery.mjs
```

O script compila cada DS com `tsc`, constrói o deck em 16:9 (`dist/gallery/<ds>/`), **falha se houver qualquer `warning` ou `error`** e monta as imagens em `packages/pptsx/docs/readme/gallery-ds/`: a capa (`hero.png`) e um painel por DS, com o nome na fonte do DS, a paleta e os quatro slides.

Para construir um deck sozinho:

```bash
node packages/pptsx/bin/pptsx.mjs build examples/gallery/gazeta/deck.tsx --size 16x9,4x3 --out dist/gallery/gazeta
```

> [!NOTE]
> Requer macOS. Georgia, DIN Condensed, Big Caslon e Andale Mono vêm do sistema (`/System/Library/Fonts/Supplemental`); nenhuma delas é copiada para o repositório. A Inter (OFL) vem de `packages/ds-base/fonts/inter/`.

> [!TIP]
> A DIN Condensed e a Big Caslon têm uma face só: a config registra o mesmo arquivo para `regular` e `bold`. A DIN Condensed tem `lineGap` de 0,2 em, que a engine conta na linha; por isso os títulos dela usam `lineHeight={1.2}`, senão o glifo sobe sobre o texto de cima.

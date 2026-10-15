# @pptsx/ds-base

Um design system de exemplo sobre o [pptsx](../pptsx/README.md), feito só com a API pública do núcleo e do [`@pptsx/ds-kit`](../ds-kit/README.md). Serve de referência para quem cria o próprio DS.

```tsx
import { Deck, defineDeck } from 'pptsx';
import { ContentLayout, CoverLayout, KpiRow, tokens } from '@pptsx/ds-base';

export default defineDeck((ctx) => (
  <Deck>
    <CoverLayout ctx={ctx} title="Resultados do trimestre" subtitle="Diretoria · outubro" />
    <ContentLayout title="Indicadores">
      <KpiRow items={[{ label: 'Receita (R$ mi)', value: '52,4', delta: '+14,2%', trend: 'up' }]} />
    </ContentLayout>
  </Deck>
));
```

| exporta | o que é |
|---|---|
| `tokens`, `theme` | cores, escala tipográfica e espaçamentos (`defineTokens`); o tema do arquivo (`themeOf`) |
| `CoverLayout`, `ContentLayout`, `ClosingLayout` | layouts que devolvem `<Slide>` |
| `Bullets`, `KpiCard`, `KpiRow`, `TwoColumn` | componentes (`defineComponent`, variantes, slots, casos de catálogo) |
| `rules`, `ds` | regras de marca e o manifesto (`createDs`) para o `pptsx lint` e o MCP |

Registre na config para o lint e o MCP conhecerem o DS: `defineConfig({ ds: [ds], theme })`. O guia do DS (`guide/*.md`) sai no MCP com `guide({ source: '@pptsx/ds-base' })`.

- **Exemplos:** [`examples/`](examples/) — a demo, a galeria (seis decks), `texto/`, `dados/`, `diagrams/arquitetura`, `arquivo/` (tema e layouts do arquivo).
- **Catálogo:** `node ../ds-kit/bin/pptsx-ds.mjs catalog src/ds.ts --out ../../dist/catalog --fixtures fixtures` grava um overview por componente; `--check` compara com `fixtures/` (o contrato visual).
- **Schema das props:** `npm run schema` (regenera `src/schema.generated.ts`).

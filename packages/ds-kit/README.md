# @pptsx/ds-kit

Ferramentas para criar um **design system (DS)** sobre o [pptsx](../pptsx/README.md): tokens, tema, componentes com variantes e slots, regras de lint, catálogo visual e o manifesto que liga o DS ao `pptsx lint` e ao MCP. Um DS usa **só** `'pptsx'` e `'@pptsx/ds-kit'` (nunca `pptsx/src/...`). Exemplo completo: [`@pptsx/ds-base`](../ds-base/README.md).

## Montagem

Projeto próprio: `npm install pptsx @pptsx/ds-kit`. Dentro deste monorepo, numa pasta nova (ex.: `examples/meu-ds/`), crie um `tsconfig.json` que aponta os pacotes para o fonte (sem build):

```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "NodeNext", "moduleResolution": "NodeNext", "strict": true,
    "allowImportingTsExtensions": true, "noEmit": true, "skipLibCheck": true,
    "jsx": "react-jsx", "jsxImportSource": "pptsx",
    "paths": {
      "pptsx": ["../../packages/pptsx/src/index.ts"],
      "pptsx/jsx-runtime": ["../../packages/pptsx/src/jsx/jsx-runtime.ts"],
      "pptsx/jsx-dev-runtime": ["../../packages/pptsx/src/jsx/jsx-dev-runtime.ts"],
      "@pptsx/ds-kit": ["../../packages/ds-kit/src/index.ts"]
    }
  }
}
```

Arquivos `.ts`/`.tsx`, imports relativos com extensão (`'./tokens.ts'`). Comandos rodam na raiz do repositório.

**Primitivas e props CSS** (`Deck`, `Slide`, `Box`, `Text`, `Image`, `Shape`, `Chart`, `Table`…; `display`, `flex`, `gap`, `padding`, `border*`, `fontSize`…) são as do núcleo: veja o guia do agente (`packages/pptsx/docs/AGENT_GUIDE.md`, §3–§4) ou o MCP (`schema({ primitive: 'box' })`). As props que saem de `createVariants` não são checadas pelo TypeScript: use nomes CSS válidos (um nome sem de/para vira `css-not-emitted` no build).

## 1. Tokens e tema

```ts
import { defineTokens, themeOf, checkTheme } from '@pptsx/ds-kit';

export const tokens = defineTokens({
  color: { ink: '#14213D', paper: '#FFFFFF', brand: '#E63946', calm: '#457B9D', mist: '#F1FAEE' },
  font: { hero: 48, title: 30, body: 18, small: 13 },
  space: { page: 40, gap: 16 },
});
// Cores (grupos color/colors) validadas e normalizadas para '#RRGGBB'; tudo congelado.
tokens.tokenAt('font.body');      // 18
tokens.scale('font.body', 1.25);  // 22.5 (arredonda a 0,5 pt)

export const theme = themeOf(tokens, {
  name: 'Minha marca',
  colors: { dark1: 'color.ink', light1: 'color.paper', accent1: 'color.brand', accent2: 'color.calm', light2: 'color.mist' },
  fonts: { heading: 'Arial', body: 'Arial' },
});
checkTheme(theme); // avisos de contraste abaixo do WCAG AA (texto 4,5:1, acentos 3:1)
```

O tema é o do arquivo PPTX (seletor de cores do PowerPoint). Slots: `dark1`, `light1`, `dark2`, `light2`, `accent1`…`accent6`, `hyperlink`, `followedHyperlink`; cada um recebe um caminho de token (`'color.ink'`) ou uma cor. Não declare o mesmo hex em dois slots. `checkTheme` compara, entre os slots declarados, texto (`dark1`/`dark2`) sobre fundo (`light1`/`light2`, 4,5:1) e cada acento sobre `light1` (3:1).

## 2. Componentes

```tsx
import { Box, Text, type Responsive } from 'pptsx';
import { createVariants, defineComponent, slot, type Slots } from '@pptsx/ds-kit';
import { tokens } from './tokens.ts';

const box = createVariants({
  base: { padding: 16, borderRadius: 8 },
  variants: {
    tone: { neutral: { backgroundColor: tokens.color.mist }, strong: { backgroundColor: tokens.color.brand, color: tokens.color.paper } },
    size: { md: { padding: 16 }, lg: { padding: 24 } },
  },
  defaults: { tone: 'neutral', size: 'md' },
});

interface StatCardProps extends Slots<'footer'> {
  readonly label: string;
  readonly value: string;
  readonly tone?: 'neutral' | 'strong';
  readonly size?: Responsive<'md' | 'lg'>;   // { base: 'md', tall: 'lg' } funciona
}

export const StatCard = defineComponent<StatCardProps>(
  {
    name: 'StatCard',          // vai no path: "Slide > StatCard[0] > Text"
    ds: 'meu-ds',
    catalog: [                 // casos do catálogo (props de exemplo)
      { name: 'neutro', props: { label: 'Receita', value: '52,4' } },
      { name: 'forte-lg', props: { label: 'NPS', value: '62', tone: 'strong', size: 'lg' } },
    ],
  },
  ({ label, value, tone, size, footer }) => (
    <Box {...box({ tone, size })} gap={4}>
      <Text fontSize={tokens.font.small}>{label}</Text>
      <Text fontSize={tokens.font.title} fontWeight="bold">{value}</Text>
      {slot(footer)}
    </Box>
  ),
);
```

- `defineComponent(meta, fn, defaults?)`: `meta.name` é o nome no path e o que as regras comparam; `defaults` preenchem props ausentes.
- `createVariants`: escolha → props CSS; ordem `base` < variantes; escolha responsiva vira props responsivas. Espalhe com `{...box({ tone, size })}` e escreva depois o que muda. Breakpoints: `base` (sempre), `tall` (slides mais altos: 4:3, 16:10) e `wide` (o preset 960×540); `{ base: 'md', tall: 'lg' }` só muda em 4:3/16:10.
- `Slots<'header' | 'body'>` e `slot(valor, padrão?)`: áreas nomeadas que recebem qualquer elemento; `filledSlots(props, nomes)` diz quais vieram.
- Um componente que **preenche o corpo** (`flex={1}`) leva `fill: true` no caso do catálogo.
- Layout de slide = componente que devolve `<Slide>` (filho direto de `<Deck>`); fica fora do catálogo (o catálogo renderiza o componente dentro de um slide).

## 3. Regras de lint

```ts
import { colorsFromTokens, defineRule, fontsFromTheme, maxChildren, onlyOnSlide } from '@pptsx/ds-kit';

export const rules = [
  colorsFromTokens('meu-ds/cores', tokens),             // cor pintada fora de tokens.color
  maxChildren('meu-ds/grade-max-3', 'StatGrid', 3),     // componente com mais de 3 filhos
  onlyOnSlide('meu-ds/hero-no-inicio', 'Hero', 1),      // componente só no slide 1
  defineRule('meu-ds/quote-curta', 'warning', (node, ctx) =>
    ctx.component?.name === 'Quote' && node.kind === 'box' && node.children.length > 2 ? [{ message: 'Quote tem texto e autor, nada mais.' }] : []),
];
```

Uma regra roda em cada slide e nó resolvido, em cada tamanho: `node` (com `css`, `props`, `path`, `children`), `ctx.component` (o meta do componente que gerou o nó; só o nó raiz dele), `ctx.slide` (slide do autor, base 1), `ctx.parent`, `ctx.theme`. Ela devolve uma lista de `{ message, severity?, path? }` (padrões: a severidade da regra e o path do nó). Prefixe o id com o nome do DS.

## 4. O manifesto

```ts
// ds.ts
import { createDs } from '@pptsx/ds-kit';
export const ds = createDs({
  name: 'meu-ds', version: '0.1.0',
  components: [StatCard, Hero, Quote],   // todos criados com defineComponent
  theme, rules,
  guide: [{ title: 'StatCard', markdown: 'Uso, props e armadilhas…' }],  // vira o guia do MCP (uma seção por parte)
});
export default ds;
```

`ds.warnings` traz os avisos de montagem (contraste). **Schema das props** (para `schema({ source })` no MCP): gere uma vez por script, não a cada carga — `schemaOf(caminhoAbsoluto, ['StatCard', …])` lê os tipos (API do TypeScript 5/6, usa o `tsconfig.json` mais próximo) e devolve o objeto; grave-o num `.ts` (`export const PROPS_SCHEMA = {…}`) e passe `schema: PROPS_SCHEMA` ao `createDs`.

## 5. Usar, conferir e publicar

- **Config** (`pptsx.config.ts`): `defineConfig({ ds: [ds], theme })` — as regras entram no `pptsx lint` e o tema no arquivo. Vale a config da pasta do deck ou a mais próxima acima dela (sem nenhuma, a do diretório de onde o comando roda).
- **Deck**: um arquivo que exporta `export default defineDeck((ctx) => <Deck>…</Deck>)` (`defineDeck` de `'pptsx'`; o `<Deck>` direto não serve). Build: `node packages/pptsx/bin/pptsx.mjs build caminho/deck.tsx --size 16x9,4x3 --out dist/meu-ds --json` (exit 1 só com `error`).
- **Lint**: `node packages/pptsx/bin/pptsx.mjs lint caminho/deck.tsx` (regras do núcleo + as do DS da config).
- **Catálogo**: `node packages/ds-kit/bin/pptsx-ds.mjs catalog caminho/ds.ts --out dist/catalogo --fixtures caminho/fixtures` grava um PNG por caso, um overview por componente e `fixtures/<Componente>.json`; `--check` compara com as fixtures (±1 pt) — o contrato visual do DS.
- **MCP**: `pptsx-mcp --ds caminho/ds.ts` (ou o `ds` da config) — `guide({ source: 'meu-ds' })` e `schema({ source: 'meu-ds' })`. No repo, para testar: `npx tsx packages/pptsx/tools/mcp/call.ts guide '{"source":"meu-ds"}' dist/mcp-img --ds ./caminho/ds.ts`.

Armadilhas: cor que não está nos tokens aparece na regra de cores (inclusive o preto padrão do texto: dê `color` no componente ou no Slide); `meta.name` diferente do nome usado nas regras faz a regra nunca disparar; caso de catálogo sem `fill` mostra o componente na largura toda e na altura do conteúdo (um `flex={1}` não estica nem encolhe); borda por lado precisa de estilo — `borderLeft="6px solid #E63946"`, não só `borderLeftWidth`/`borderLeftColor` (o build avisa).

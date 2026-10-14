# pptsx

Slides escritos em TSX com **CSS como props** (box model, flexbox, grid, `zIndex`), sem coordenadas, viram um `.pptx` editável que se adapta sozinho a vários tamanhos de slide (16:9, 4:3, wide…). Feito para devs e para agentes de IA: o layout é calculado pela engine e todo problema volta como diagnóstico com caminho até o nó.

## Instalação

```sh
npm install pptsx
```

Requer Node ≥ 20. O projeto precisa ser ESM (`"type": "module"` no `package.json`), porque o pacote usa top-level await; o `pptsx init` cuida disso.

## Início rápido

```sh
mkdir meu-deck && cd meu-deck
npm install pptsx
npx pptsx init
npx pptsx build deck.tsx --size 16x9,4x3
```

O `init` cria (ou completa) no diretório atual, ou em `npx pptsx init <dir>`:

| arquivo | conteúdo |
|---|---|
| `deck.tsx` | deck de exemplo com 2 slides, só primitivas |
| `tsconfig.json` | `jsx: react-jsx`, `jsxImportSource: pptsx`, `module: NodeNext`, `strict` |
| `pptsx.config.ts` | `defineConfig({})` com as opções comentadas |
| `assets/.gitkeep` | pasta para imagens (caminhos relativos ao deck) |
| `.gitignore` | `dist/` (acrescentado se o arquivo já existe) |
| `package.json` | criado com `"type": "module"`; se já existe, ganha `"type": "module"` (um `"commonjs"` é trocado, com aviso) |

Se `deck.tsx` já existe, o `init` para; `--force` sobrescreve os arquivos gerados (`.gitignore` e `package.json` são sempre mesclados, nunca apagados).

O `build` grava em `dist/`:

```
dist/
├── deck.16x9.pptx
├── deck.16x9.overview.png      ← grade com todos os slides; selo vermelho = error, amarelo = warning
├── deck.16x9/slide-01.png …    ← um PNG por slide
├── deck.4x3.pptx / deck.4x3.overview.png / deck.4x3/…
└── deck.diagnostics.json       ← diagnósticos de todos os tamanhos
```

Durante a edição, `npx pptsx build deck.tsx --size 16x9,4x3 --watch` refaz tudo a cada arquivo salvo.

## Primeiro deck

```tsx
import { Box, Deck, Slide, Text, defineDeck } from 'pptsx';

export default defineDeck((ctx) => (
  <Deck>
    <Slide padding={40} gap={20} backgroundColor="#FFFFFF" color="#1B2A4A">
      <Text fontSize={36} fontWeight="bold" borderLeft="6px solid #2F6FED" paddingLeft={14}>
        Resultados do trimestre
      </Text>
      <Box display="grid" gridTemplateColumns={{ base: '1fr 1fr', tall: '1fr' }} gap={20}>
        <Box backgroundColor="#F4F6FA" borderRadius={8} padding={20}><Text>Receita cresceu 18%.</Text></Box>
        <Box backgroundColor="#F4F6FA" borderRadius={8} padding={20}><Text>Churn caiu para 2,1%.</Text></Box>
      </Box>
      <Text fontSize={11} color="#5B6680" marginTop="auto">Fonte: dados internos · {ctx.name}</Text>
    </Slide>
  </Deck>
));
```

- As props são **CSS em camelCase**: números são pt (`'12px'` também), `'50%'` é do pai, e os shorthands funcionam como no browser (`padding="8 16"`, `border="2px solid #ccc"`, `margin="0 auto"`, `flex={1}`).
- `Slide` e `Box` são contêineres. A única diferença intencional em relação ao browser: **`Box` sem `display` é uma coluna flex** que estica os filhos; `display="flex"` é row, `display="grid"` é grid, `display="none"` some.
- Não existem coordenadas: posição e tamanho de tudo saem do layout, em pt (1 pol = 72 pt).
- O texto é medido com a fonte real e quebrado em linhas; se não couber, a fonte encolhe até um mínimo, corta com reticências ou vira erro, conforme `fit`.
- Qualquer prop aceita um valor por breakpoint: `{ base, tall?, wide?, '4x3'?, … }`. `tall` vale quando a proporção é menor que 1,5 (4:3, 16:10); `wide` quando o slide é maior que o 16:9 de referência; o nome exato do tamanho vence os dois. O grid acima vira uma coluna em 4:3 sem nenhum `if` no deck.
- A função ainda recebe um `ctx` por tamanho (`name`, `width`, `height`, `aspect`, `scale`) e `ctx.pick(valor)` resolve um valor responsivo em código, para contagens ou textos alternativos.
- Um `<Box paginate>` com itens demais continua num slide clonado (mesmo título, mesmas decorações) em vez de encolher a fonte: a lista de 12 bullets vira dois slides e o diagnóstico `slide-continued` conta as partes.

## CSS que funciona

**Grid.** `gridTemplateColumns`/`Rows` com pt, `%`, `fr`, `auto`, `min-content`, `max-content`, `minmax()` e `repeat(n, …)`; no item, `gridColumn="span 2"`, `"2 / -1"`, `gridRow`, `justifySelf`/`alignSelf`. Um `Chart` numa célula estica nela.

```tsx
<Box display="grid" gridTemplateColumns="repeat(3, minmax(0, 1fr))" gap={16}>
  {cards.map((c) => <Box padding={14} backgroundColor="#FFFFFF" boxShadow="0 3px 10px rgba(0,0,0,.15)">…</Box>)}
</Box>
```

**Margin auto.** `marginTop="auto"` empurra um rodapé para o fim do slide; `margin="0 auto"` centraliza um bloco com largura. Nada de Box vazio para empurrar.

**Herança.** `fontFamily`, `fontSize`, `fontWeight`, `fontStyle`, `color`, `lineHeight`, `textAlign`, `letterSpacing` e `textTransform` declarados num `Slide` ou `Box` descem para os `Text` de dentro. Um cartão define a fonte e a cor uma vez; os textos dizem só o que muda.

**Camadas.** Como no browser, nós posicionados, com `zIndex`, `opacity` ou `rotate` sobem de camada: `zIndex={-1}` põe uma decoração absoluta atrás do conteúdo (sem ele, ela pinta por cima).

```tsx
<Shape kind="ellipse" position="absolute" right={-90} top={-110} width={360} height={360} backgroundColor="#101B33" zIndex={-1} />
```

Também: `flexWrap="wrap"` (tags que quebram em linhas), bordas por lado (`borderTop`, `borderLeft="4px solid …"`, tracejada/pontilhada), `borderRadius`, `boxShadow` (uma, externa), `opacity`, `rotate`/`transform: rotate() translate()`, `backgroundImage="url(…)"`, `letterSpacing`, `textTransform`, `textDecoration`. O guia completo, com receitas e a tabela de migração das props antigas (`direction`, `grow`, `fill`, `size`…, ainda aceitas como alias), está em [`docs/AGENT_GUIDE.md`](docs/AGENT_GUIDE.md).

## Rich text

```tsx
import { B, I, Span, Text } from 'pptsx';

<Text fontSize={20}>
  Receita <B>subiu 14%</B> em <Span color="#2F6FED" fontStyle="italic">todas</Span> as regiões, <I>exceto</I> no Norte.
</Text>
```

- `Span` muda `fontWeight`, `fontStyle`, `color` e `textDecoration` de um trecho; `B` e `I` são atalhos. Só valem dentro de `Text`. Tamanho, fonte e entrelinha são do `Text` inteiro.
- A medição soma a largura de cada trecho com a face certa (regular, negrito, itálico), e o `.pptx` sai com um run por trecho.
- `alignItems="baseline"` numa row (`display="flex"`) alinha textos de tamanhos diferentes pela linha de base (valor grande + variação pequena).
- `lineHeight` segue o CSS: `'normal'` (padrão) é a altura natural da fonte; um número é múltiplo do `fontSize` (`1.2` em 20 pt = 24 pt por linha).
- Para a linha não quebrar entre número e unidade, use NBSP (`R$&nbsp;52,4&nbsp;mi` no texto JSX, `'\u00A0'` em strings); para um texto inteiro numa linha só, `<Text nowrap>` (se não couber, encolhe até `minSize` e depois vira `text-overflow`).

## CLI

```
pptsx build <deck.tsx> [flags]
pptsx init [dir] [--force] [--json]
```

| comando / flag | padrão | o que faz |
|---|---|---|
| `build <deck.tsx>` | — | renderiza o deck (export default `defineDeck(...)`) e grava os arquivos |
| `--size <lista>` | `16x9` | tamanhos separados por vírgula: `16x9`, `16x10`, `4x3`, `wide` ou custom em polegadas (`10x7.5in`) |
| `--out <dir>` | `dist` | diretório de saída |
| `--debug` | desligado | contorno vermelho tracejado em toda Box/Text/Image/Chart/Table, no `.pptx` e no PNG; no PNG, o texto que estoura fica em vermelho |
| `--json` | desligado | stdout só com JSON (ver abaixo) |
| `--preview native\|none` | `native` | `none` não gera PNGs (só `.pptx` e diagnósticos) |
| `--preview-width <px>` | `1280` | largura de cada PNG de slide |
| `--lang <tag>` | `pt-BR` | idioma do texto no `.pptx` (corretor ortográfico) |
| `--line-breaks forced\|auto` | `forced` | como as linhas saem no `.pptx` (ver [Limitações](#limitações-atuais)) |
| `--watch` | desligado | build inicial e rebuild a cada mudança na pasta do deck ou na config |
| `--embed-fonts` | desligado | embute no `.pptx` (EOT) as fontes registradas que o deck usa; só o PowerPoint respeita (o Keynote ignora) |
| `init [dir]` | `.` | cria o projeto (ver [Início rápido](#início-rápido)) |
| `init --force` | desligado | sobrescreve um `deck.tsx` existente e os demais arquivos gerados |
| `init --json` | desligado | stdout `{ "files": [...] }` com os arquivos gravados; avisos vão para stderr |

**Exit codes:** `build` sai com `1` se houver qualquer diagnóstico `error`, erro de sintaxe/estrutura do deck ou flag inválida, e `0` caso contrário (`warning` e `info` não falham). `init` sai com `1` se `deck.tsx` já existe sem `--force`. `--watch` só termina com Ctrl-C, e sai com `0`.

**`--json`:** stdout tem só `{ "files": [...], "diagnostics": [...] }`, com o caminho de cada `.pptx`, PNG, overview e do `diagnostics.json` (mais `fontsMissing`, se alguma fonte do sistema pedida em `fonts` não foi achada). Se o deck nem roda (erro de sintaxe, texto fora de `<Text>`…), stdout tem `{ "error": "mensagem" }`.

**`--watch --json`:** um JSON por build, um por linha (NDJSON), no mesmo formato (`{ files, diagnostics }` ou `{ error }`). Um erro no deck não derruba o watch. Cada build recarrega o deck, a config e os componentes e tokens que eles importam. A pasta de saída, `node_modules` e `.git` são ignorados.

## Config

`pptsx.config.ts` no diretório de onde a CLI é chamada (opcional):

```ts
import { defineConfig } from 'pptsx';

export default defineConfig({
  sizes: ['16x9', '4x3'],
  lang: 'pt-BR',
  textSafety: 0.97,
  lineBreaks: 'forced',
  embedFonts: false,
  fonts: [
    { family: 'Inter', weight: 'regular', file: './fonts/Inter-Regular.ttf' },
    { family: 'Inter', weight: 'bold', file: './fonts/Inter-Bold.ttf' },
    { family: 'Helvetica', weight: 'regular' }, // sem file: fonte instalada no sistema
    { family: 'Helvetica', weight: 'bold' },
  ],
});
```

| campo | o que faz |
|---|---|
| `sizes` | tamanhos usados quando `--size` não é passado |
| `lang` | como `--lang` |
| `textSafety` | fração da largura usada na quebra de linha (padrão `0.97`); a caixa sai com a largura cheia |
| `lineBreaks` | como `--line-breaks` |
| `fonts` | `{ family, weight: 'regular' \| 'bold', italic?, file? }`, uma entrada por face; caminhos relativos ao arquivo de config. Sem `file`, a face é procurada nas pastas de fontes do sistema (macOS, Linux, Windows); se não existir, sai em `fontsMissing` e cada `Text` que a usa ganha `font-missing`. **Substitui** as fontes padrão: se o deck ainda usa Arial, registre também a Arial (do sistema ou por arquivo) |
| `embedFonts` | como `--embed-fonts` |

Precedência: flag da CLI > config > padrão.

## API programática

```ts
import { render } from 'pptsx';
import type { RenderOptions, RenderResult } from 'pptsx';

render(deck: DeckDefinition, options?: RenderOptions): Promise<RenderResult[]>  // um resultado por tamanho
```

| `RenderOptions` | padrão | |
|---|---|---|
| `sizes` | `['16x9']` | presets ou `{ width, height }` em polegadas |
| `fonts` | Liberation Sans como Arial | `FontFace[]`, como na config (`file` opcional: sem ele, fonte do sistema) |
| `preview` | `{ mode: 'native', width: 1280 }` | `false` desliga os PNGs |
| `debug` | `false` | contornos de debug no `.pptx` e no PNG |
| `baseDir` | `process.cwd()` | base para `src` relativos de imagens (a CLI usa a pasta do deck) |
| `lang` | `'pt-BR'` | |
| `textSafety` | `0.97` | |
| `lineBreaks` | `'forced'` | `'forced'` ou `'auto'` |
| `includePositioned` | `false` | devolve a árvore posicionada (pós-fit) em `positioned` |
| `embedFonts` | `false` | embute as faces usadas (`.ttf` de uma face, licença que permita embed; nunca a Arial padrão); as que não podem geram `font-not-embeddable` |

| `RenderResult` | |
|---|---|
| `size` | nome do tamanho (`'16x9'`, `'custom-10x7.5'`) |
| `buffer` | o `.pptx` (`Buffer`) |
| `diagnostics` | `Diagnostic[]` deste tamanho |
| `preview` | `{ slides: Buffer[], overview: Buffer }` (PNGs), se o preview estiver ligado |
| `positioned` | árvore com frames em pt, só com `includePositioned` |
| `fontsMissing` | faces pedidas em `fonts` sem `file` que não foram achadas no sistema (`['Inter bold']`); ausente se nenhuma |

O `render` não grava arquivos nem imprime. Exemplo (`build.ts`, rodado com `npx tsx build.ts` num projeto criado pelo `init`):

```ts
import { mkdir, writeFile } from 'node:fs/promises';
import { render } from 'pptsx';
import deck from './deck.tsx';

const results = await render(deck, { sizes: ['16x9', '4x3'], preview: false });
await mkdir('dist', { recursive: true });
for (const { size, buffer, diagnostics } of results) {
  await writeFile(`dist/deck.${size}.pptx`, buffer);
  diagnostics.forEach((d) => console.log(`${d.severity} ${d.code} em ${d.path}: ${d.message}`));
}
```

Para checar tipos desse script com `tsc`, instale `@types/node`.

## Diagnósticos

- Cada diagnóstico tem `size`, `slide` (a partir de 1), `severity`, `code`, `path`, `message` (o que fazer) e `data` opcional.
- `severity`: `error` precisa de correção; `warning` é aceitável se intencional; `info` é só aviso (ex.: fonte reduzida).
- `path` vai do slide até o nó, com nomes de primitivas e de componentes: `ContentLayout > Box > Bullets > Box[2] > Text`.
- Dentro de grid, o estouro diz o tamanho da célula ("a célula do grid tem 212 × 60 pt"); num wrap, quanto as linhas ocupam.
- `css-not-emitted` (warning) lista toda propriedade CSS que não tem de/para no PPTX, com o valor, o motivo e o path; o preview também não a desenha.
- `data.causedBy` marca um estouro que é consequência de outro nó: corrija a causa primeiro e os derivados somem.
- Irmãos com o mesmo problema viram um item só (`Box[0..7]`, com `data.count` e `data.paths`).
- Exit code `1` se houver algum `error`. O formato completo, os códigos e as correções estão em [`docs/AGENT_GUIDE.md`](docs/AGENT_GUIDE.md).

## Como funciona

1. O deck é TSX com um runtime JSX próprio (sem React): `defineDeck(ctx)` roda uma vez por tamanho e devolve uma árvore de elementos.
2. A árvore é resolvida: componentes viram primitivas, a estrutura é validada (texto só dentro de `Text`, só `Slide` no `Deck`), cada nó recebe seu `path` e as props viram um estilo CSS normalizado (shorthands expandidos, valores responsivos escolhidos, propriedades de texto herdadas, nomes antigos convertidos).
3. O layout segue o browser: o Yoga (flexbox em WASM, com os padrões da web) calcula o box model e o flex, e um motor de grid próprio dimensiona os tracks e posiciona os itens nas células; o texto entra como folha medida.
4. O fontkit mede o texto com as métricas reais da fonte (largura dos glifos, kerning, ascender/descender, `letterSpacing`) e quebra as linhas por palavra.
5. O fit aplica a política de cada `Text` (`shrink`, `truncate`, `error`) sobre a área de conteúdo (frame − borda − padding, ou a célula do grid), refaz o layout quando a fonte muda e gera os diagnósticos.
6. A pintura segue a ordem do CSS (`zIndex`, opacidade e rotação herdadas); o pptxgenjs emite o `.pptx` com formas, texto, gráficos e tabelas nativos, e o preview desenha os mesmos itens em SVG, rasterizados pelo resvg.

## Limitações atuais

- **CSS sem equivalente no PPTX não sai** (warning `css-not-emitted`, e o preview também não desenha): `overflow: hidden` (o PPTX não recorta), gradientes em `backgroundImage`, `filter`, `transform: scale/skew`, sombra `inset`/`spread`/múltipla, raio diferente por canto (sai o menor), `fontWeight` fora de regular/bold.
- **Opacidade é por forma, não de grupo.** `opacity` num Box multiplica a transparência de cada forma e texto de dentro; onde elas se sobrepõem, a de cima não "apaga" a de baixo como num grupo do browser.
- **Bordas por lado são linhas.** Com `borderRadius` e bordas diferentes por lado, o fundo arredonda mas as linhas saem retas (avisa). `Chart` e `Table` não giram.
- **Fora do escopo do CSS:** `float`, `position: fixed/sticky`, unidades `em`/`rem`/`vw`, áreas nomeadas e `auto-fill` no grid.
- **Só Arial por padrão.** A engine mede com Liberation Sans (métricas compatíveis, incluída no pacote) e o arquivo sai com `Arial`. Outras famílias entram em `fonts`, por arquivo ou instaladas no sistema (sem `file`); uma família não registrada ou não achada gera `font-missing`.
- **Fonte embutida só no PowerPoint.** `--embed-fonts` grava as faces em EOT dentro do `.pptx`. O PowerPoint usa a fonte embutida; o Keynote ignora e troca pela dele (o Google Slides não foi testado). Só entram `.ttf` de uma face com licença que permite embed (`.ttc` e `.otf` CFF geram `font-not-embeddable`).
- **Quebra de linha forçada por padrão.** Com `lineBreaks: 'forced'`, cada linha calculada vira uma quebra manual no `.pptx`: o resultado bate com o preview, mas quem editar o texto no PowerPoint herda essas quebras. `lineBreaks: 'auto'` emite só os parágrafos e deixa o aplicativo requebrar: fica mais editável, mas pode divergir da medição (no Keynote, 10 de 34 amostras quebram em outra palavra e 2 perdem uma linha; nenhuma vaza do frame, porque a engine mede com 3 % de folga). O preview PNG mostra sempre as quebras da engine, não as do aplicativo.
- **Rich text limitado ao estilo do trecho.** `Span`/`B`/`I` mudam peso, itálico, cor e decoração; tamanho, fonte e entrelinha valem para o `Text` inteiro.
- **Validado no Keynote.** A calibração da medição de texto foi feita exportando pelo Keynote; PowerPoint e Google Slides ainda não foram validados.

## Desenvolvimento

```sh
npm test               # vitest
npm run typecheck      # tsc
npm run build          # compila src/ para dist/ (JS + .d.ts)
npm run test:package   # npm pack → instala num projeto vazio → init → build (lento; precisa de rede ou do cache do npm)
node bin/pptsx.mjs build examples/demo.tsx --size 16x9,4x3,wide --out dist/
scripts/keynote-export.sh dist/demo.16x9.pptx dist/keynote/   # exporta os slides pelo Keynote (macOS)
```

Dentro do repo, `bin/pptsx.mjs` roda direto de `src/` (sem build) e os decks importam `pptsx` pelo `paths` do `tsconfig.json`. Exemplos em `examples/`, todos em CSS:

| arquivo | o que mostra |
|---|---|
| `demo.tsx` | deck completo com layouts e componentes (grid de KPIs, duas colunas que empilham em 4:3, gráfico e tabela nativos), sem nenhum `if` sobre o tamanho |
| `showcase.tsx` | vitrine do CSS: grid com `span` e `2 / -1`, wrap, `marginTop="auto"`, `zIndex`, herança, bordas por lado, sombra, `rotate`, `opacity`, `display` responsivo |
| `long-list.tsx` | lista paginada em slides de continuação |
| `charts.tsx` | os três gráficos nativos (barra, linha, pizza) |
| `hello.tsx`, `layout-test.tsx` | posicionamento absoluto; flex, imagens (`objectFit`) e alinhamentos |
| `overflow.tsx`, `probe/cause.tsx`, `probe/table.tsx`, `probe/css.tsx` | slides lotados de propósito: cada um termina com o diagnóstico esperado (exit 1) |
| `calibration.tsx`, `calibration-rich.tsx` | grades de calibração da medição de texto e do rich text |
| `layouts/`, `components/`, `tokens.ts` | `CoverLayout`, `ContentLayout`, `ClosingLayout`; `Bullets`, `KpiCard`, `KpiRow`, `TwoColumn` | Spec em [`docs/spec.md`](docs/spec.md); guia para agentes em [`docs/AGENT_GUIDE.md`](docs/AGENT_GUIDE.md).

## Licença

MIT. As fontes Liberation Sans em `fonts/` têm licença própria (`fonts/LICENSE`).

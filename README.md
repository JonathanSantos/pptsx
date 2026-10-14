# pptsx

Slides escritos em TSX, sem coordenadas, viram um `.pptx` editável que se adapta sozinho a vários tamanhos de slide (16:9, 4:3, wide…). Feito para devs e para agentes de IA: o layout é calculado pela engine e todo problema volta como diagnóstico com caminho até o nó.

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
import { Box, Deck, Shape, Slide, Text, defineDeck } from 'pptsx';

export default defineDeck((ctx) => (
  <Deck>
    <Slide padding={40} gap={20} background="#FFFFFF">
      <Shape kind="rect" height={6} fill="#2F6FED" />
      <Text size={36} weight="bold">Resultados do trimestre</Text>
      <Box direction={{ base: 'row', tall: 'column' }} gap={20} grow={1}>
        <Box grow={1} fill="#F4F6FA" radius={8} padding={20}><Text>Receita cresceu 18%.</Text></Box>
        <Box grow={1} fill="#F4F6FA" radius={8} padding={20}><Text>Churn caiu para 2,1%.</Text></Box>
      </Box>
    </Slide>
  </Deck>
));
```

- `Slide` e `Box` são contêineres flexbox; a direção padrão é **coluna** (filhos empilhados), e `grow`, `gap`, `padding`, `align` e `justify` funcionam como no CSS.
- Não existem coordenadas: posição e tamanho de tudo saem do layout, em pt (1 pol = 72 pt).
- O texto é medido com a fonte real e quebrado em linhas; se não couber, a fonte encolhe até um mínimo, corta com reticências ou vira erro, conforme `fit`.
- Qualquer prop aceita um valor por breakpoint: `{ base, tall?, wide?, '4x3'?, … }`. `tall` vale quando a proporção é menor que 1,5 (4:3, 16:10); `wide` quando o slide é maior que o 16:9 de referência; o nome exato do tamanho vence os dois. O `Box` acima empilha em 4:3 sem nenhum `if` no deck.
- A função ainda recebe um `ctx` por tamanho (`name`, `width`, `height`, `aspect`, `scale`) e `ctx.pick(valor)` resolve um valor responsivo em código, para contagens ou textos alternativos.
- Um `<Box paginate>` com itens demais continua num slide clonado (mesmo título, mesmas decorações) em vez de encolher a fonte: a lista de 12 bullets vira dois slides e o diagnóstico `slide-continued` conta as partes.

## Rich text

```tsx
import { B, I, Span, Text } from 'pptsx';

<Text size={20}>
  Receita <B>subiu 14%</B> em <Span color="#2F6FED" italic>todas</Span> as regiões, <I>exceto</I> no Norte.
</Text>
```

- `Span` muda `weight`, `italic` e `color` de um trecho; `B` e `I` são atalhos. Só valem dentro de `Text`. Tamanho, fonte e entrelinha são do `Text` inteiro.
- A medição soma a largura de cada trecho com a face certa (regular, negrito, itálico), e o `.pptx` sai com um run por trecho.
- `align="baseline"` numa row alinha textos de tamanhos diferentes pela linha de base (valor grande + variação pequena).
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
| `--debug` | desligado | contorno vermelho tracejado em toda Box/Text/Image, no `.pptx` e no PNG; no PNG, o texto que estoura fica em vermelho |
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
- `path` vai do slide até o nó, com nomes de primitivas e de componentes: `ContentLayout > Box[1] > Bullets > Box[2] > Text`.
- `data.causedBy` marca um estouro que é consequência de outro nó: corrija a causa primeiro e os derivados somem.
- Irmãos com o mesmo problema viram um item só (`Box[0..7]`, com `data.count` e `data.paths`).
- Exit code `1` se houver algum `error`. O formato completo, os códigos e as correções estão em [`docs/AGENT_GUIDE.md`](docs/AGENT_GUIDE.md).

## Como funciona

1. O deck é TSX com um runtime JSX próprio (sem React): `defineDeck(ctx)` roda uma vez por tamanho e devolve uma árvore de elementos.
2. A árvore é resolvida: componentes viram primitivas, a estrutura é validada (texto só dentro de `Text`, só `Slide` no `Deck`) e cada nó recebe seu `path`.
3. O Yoga (flexbox em WASM) calcula posição e tamanho de cada nó; o texto entra como folha medida.
4. O fontkit mede o texto com as métricas reais da fonte (largura dos glifos, kerning, ascender/descender) e quebra as linhas por palavra.
5. O fit aplica a política de cada `Text` (`shrink`, `truncate`, `error`), refaz o layout quando a fonte muda e gera os diagnósticos.
6. O pptxgenjs emite o `.pptx` com caixas e texto nativos; o preview desenha a mesma árvore em SVG e o resvg rasteriza os PNGs.

## Limitações atuais

- **Só Arial por padrão.** A engine mede com Liberation Sans (métricas compatíveis, incluída no pacote) e o arquivo sai com `Arial`. Outras famílias entram em `fonts`, por arquivo ou instaladas no sistema (sem `file`); uma família não registrada ou não achada gera `font-missing`.
- **Fonte embutida só no PowerPoint.** `--embed-fonts` grava as faces em EOT dentro do `.pptx`. O PowerPoint usa a fonte embutida; o Keynote ignora e troca pela dele (o Google Slides não foi testado). Só entram `.ttf` de uma face com licença que permite embed (`.ttc` e `.otf` CFF geram `font-not-embeddable`).
- **Quebra de linha forçada por padrão.** Com `lineBreaks: 'forced'`, cada linha calculada vira uma quebra manual no `.pptx`: o resultado bate com o preview, mas quem editar o texto no PowerPoint herda essas quebras. `lineBreaks: 'auto'` emite só os parágrafos e deixa o aplicativo requebrar: fica mais editável, mas pode divergir da medição (no Keynote, 10 de 34 amostras quebram em outra palavra e 2 perdem uma linha; nenhuma vaza do frame, porque a engine mede com 3 % de folga). O preview PNG mostra sempre as quebras da engine, não as do aplicativo.
- **Rich text limitado ao estilo do trecho.** `Span`/`B`/`I` mudam peso, itálico e cor; tamanho, fonte e entrelinha valem para o `Text` inteiro.
- **Sem gráficos e tabelas nativos** (gráfico entra como imagem; tabela, como `Box`/`Text`). Previsto no M10.
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

Dentro do repo, `bin/pptsx.mjs` roda direto de `src/` (sem build) e os decks importam `pptsx` pelo `paths` do `tsconfig.json`. Exemplos em `examples/`: `demo.tsx` (deck completo com layouts e componentes, sem nenhum `if` sobre o tamanho), `long-list.tsx` (lista paginada em slides de continuação), `hello.tsx`, `overflow.tsx`, `layout-test.tsx`, os decks de calibração `calibration.tsx` (medição de texto) e `calibration-rich.tsx` (rich text, NBSP, nowrap e baseline), além de `layouts/`, `components/` e `tokens.ts`. Spec em [`docs/spec.md`](docs/spec.md); guia para agentes em [`docs/AGENT_GUIDE.md`](docs/AGENT_GUIDE.md).

## Licença

MIT. As fontes Liberation Sans em `fonts/` têm licença própria (`fonts/LICENSE`).

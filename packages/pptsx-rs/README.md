# pptsx-rs — o pptsx em Rust

Um binário só (5,9 MB) que lê um deck `.tsx` e grava `.pptx`, **sem Node e sem motor JS
embutido**. O pptsx em TypeScript (`packages/pptsx`) é a referência: este pacote reproduz a saída
dele (ver [paridade](#paridade-com-o-pptsx-em-ts)) e tem a mesma versão. A release de cada tag traz
o binário para macOS (arm64 e x86_64), Linux (x86_64 e arm64) e Windows (x86_64), com o `SHA256SUMS`.

```bash
# instalar da release (macOS/Linux): baixe o tar.gz do seu alvo e extraia o binário
curl -LO https://github.com/JonathanSantos/pptsx/releases/latest/download/pptsx-rs-aarch64-apple-darwin.tar.gz
tar -xzf pptsx-rs-aarch64-apple-darwin.tar.gz && ./pptsx-rs-aarch64-apple-darwin/pptsx-rs --version
```

```bash
cargo build --release          # na raiz do monorepo (workspace) ou em packages/pptsx-rs
cd packages/pptsx-rs
./target/release/pptsx-rs build ../pptsx/examples/hello.tsx --size 16x9,4x3 --out dist/
./target/release/pptsx-rs check ../ds-base/examples/demo.tsx --debug   # diagnósticos + frames
./target/release/pptsx-rs check deck.tsx --json                                 # diagnósticos em JSON
./target/release/pptsx-rs tree  ../pptsx/examples/layout-test.tsx      # árvore avaliada
./target/release/pptsx-rs build deck.tsx --watch                                # rebuild a cada mudança
./target/release/pptsx-rs build deck.tsx --serve                                # preview ao vivo no navegador
./target/release/pptsx-rs init meu-deck                                         # deck.tsx, tsconfig, config
./target/release/pptsx-rs build deck.tsx --embed-fonts                          # fontes do autor no arquivo (EOT)
./target/release/pptsx-rs lint  ../ds-orbit/examples/project.tsx       # regras da engine e dos DS
./target/release/pptsx-rs mcp                                                   # servidor MCP (stdio)
```

Saída: `dist/<deck>.<tamanho>.pptx`, como no `pptsx build`. Tamanhos: `16x9`, `16x10`, `4x3`,
`wide` ou `<L>x<A>in`. Sem `--size`, vale o `sizes` do `pptsx.config.ts` (como no TS).
`--line-breaks auto` grava os parágrafos do autor e deixa o PowerPoint quebrar (o padrão,
`forced`, grava uma quebra por linha calculada). Como no pptsx, o build sai com código 1 quando
há diagnóstico `error`, e grava `dist/<deck>.diagnostics.json` com a lista do pptsx (código,
severidade, slide, path do nó, mensagem e dados).

O `build` também grava o preview, como o pptsx: `dist/<deck>.<tamanho>/slide-NN.png` e
`dist/<deck>.<tamanho>.overview.png`, rasterizados no próprio binário (SVG com o contorno dos
glifos → `resvg`, um slide por thread). `--preview none` desliga; `--preview-width N` muda a
largura. `--watch` refaz o build quando o deck, a config ou qualquer módulo importado muda; cada
build roda num processo filho (o avaliador vaza a AST de propósito, então a memória volta a zero a
cada rebuild). `--serve [--port 4173]` sobe o preview ao vivo do pptsx (a mesma página do
`pptsx preview --serve`: slides em SVG, diagnósticos, clique destaca o nó, atualização por SSE)
lendo o que o build filho grava; `?debug=1` serve o mesmo SVG (o preview do Rust não tem
contornos de debug). `init [pasta] [--force] [--json]` cria `deck.tsx`, `tsconfig.json`,
`pptsx.config.ts`, `assets/`, `.gitignore` e `package.json` como o `pptsx init` (mescla os que
existem; sem `--ds`).

## Resultado medido

### Paridade com o pptsx em TS

Os **80 decks de exemplo do repositório** (`packages/*/examples`, incluindo os que usam
`@pptsx/ds-base` e `@pptsx/ds-orbit`, com a composição por `<Container>` do M19: `compose` e as
matrizes de tamanho) gerados nas duas engines e comparados caixa a caixa (texto com as quebras de
linha + frame com tolerância de 1 pt):

| métrica | resultado |
|---|---|
| decks que geram nas duas engines | 80/80, com o mesmo número de slides em todos |
| caixas de texto idênticas | **8617/8617 (100%)** |
| decks 100% idênticos | **80/80** |
| geometrias livres (`custGeom`: Path, ícones, conectores) idênticas | **3496/3496** |
| diagnósticos do TS que o Rust dá no mesmo nó (código, slide, path) | **1704/1704**, sem nenhum a mais |
| … com a mensagem idêntica | 1702/1704 |
| achados do lint idênticos | **2074/2074** |

As duas mensagens que diferem dizem a causa de um estouro ("X pede 0 pt a mais"): o TS soma a
altura do texto em f64 (JavaScript) e o Yoga devolve f32, e essa diferença de 10⁻⁶ pt basta para
ele apontar uma causa que o Rust não aponta.

O port do Yoga é fiel até no float: numa row com `nowrap` que não cabe, o resíduo em f32 do total
de shrink pode sair positivo e as larguras explodem; o yoga-layout real faz o mesmo com os mesmos
números (teste `shrink_residual_matches_yoga`), e o fit do pptsx contorna isso partindo do piso
das palavras (`wordFloorOf`), que o Rust também segue.

Os `.pptx` abrem e exportam no Keynote (`scripts/keynote-export.sh`): tabelas com mesclagem e
ícones, gráficos de todos os tipos, Path, ícones, sombra, rotação, paginação, imagem de fundo,
layouts com placeholders e conteúdo fixo (`ds-base/examples/arquivo`) e os decks do `ds-orbit`.

### Desempenho

Mac arm64; Node 24 rodando o pptsx do repositório (`--preview none`); Rust em release.
Mediana de 5 (Node) e 10 (Rust) execuções do processo inteiro.

| deck | Node | Rust | ganho | memória Node | memória Rust |
|---|---:|---:|---:|---:|---:|
| `hello` | 367 ms | 6,4 ms | 58× | 167 MB | 6,7 MB |
| `layout-test` | 381 ms | 8,9 ms | 43× | 169 MB | 7,2 MB |
| `calibration` | 448 ms | 19,4 ms | 23× | 175 MB | 8,7 MB |
| `ds-base/demo` | 681 ms | 20,5 ms | 33× | 229 MB | 10,7 MB |
| `ds-base/showcase` | 667 ms | 32,4 ms | 21× | 228 MB | 9,6 MB |
| `ds-orbit/compose` (9 slides, `Container`) | 870 ms | 73 ms | 12× | — | — |
| `ds-orbit/matrix-lists-a` (28 slides, 66 `Container`) | 1450 ms | 190 ms | 8× | — | — |

O Node aqui transpila o próprio código-fonte do pptsx a cada execução (`tsx`); a versão
publicada (`dist/`) começa mais rápido, então o ganho real fica um pouco abaixo. Nos decks do
`ds-orbit` o ganho é menor: o DS é grande (o avaliador leva ~40 ms só para carregá-lo) e cada
`Container` roda a função dele no avaliador depois da medida (uma vez por medida: o cache evita
rodar os de fora de novo quando os de dentro são medidos).

Com o preview PNG ligado, o `ds-base/demo` (6 slides) sai em ~80 ms no total.

Binário: **5,9 MB**: 1,6 MB são as quatro Liberation Sans embutidas, e o resto inclui o
`regex` com tabelas Unicode, o `resvg` (ícones complexos viram PNG, como no TS) e o guia e o
schema do pptsx (para o MCP).

### Teste de paridade (fixtures douradas)

`scripts/golden.sh` gera com o pptsx em TS a saída de referência dos decks de exemplo (`hello`,
`layout-test`, `overflow`, `demo`, `charts`, `showcase`, `long-list`, em 16x9 e 4x3) e grava em
`fixtures/`: o `diagnostics.json` e os `slideN.xml`/`chartN.xml` crus de cada `.pptx`.
`cargo test` roda o binário nesses decks e compara, em `tests/golden.rs`, forma a forma: frames,
caminhos e `srcRect` com tolerância de 2 EMU, texto com as quebras, corpo, peso e cor de cada
trecho, preenchimento e contorno, células de tabela com bordas, e os gráficos (valores, título,
estilo de texto, linhas dos eixos). Os diagnósticos comparam código, severidade, tamanho, slide,
path e mensagem. Quando o TS mudar, rode o script de novo; uma diferença sai como diff legível.

## Como funciona

```
deck.tsx ─oxc_parser─► AST ─avaliador do subconjunto─► árvore de elementos
         ─validação (props, CSS sem de/para)─► resolve (CSS, herança, responsivo)
         ─Container: layout mede o espaço, a função roda, resolve de novo (M19)
         ─paginate ─► layout (port do Yoga; grid) + fit (shrink por escopo)─► frames
         ─diagnósticos (estouro, causa, agrupamento)
         ─emissor OOXML─► slides, tabelas, gráficos, notas ─zip─► .pptx
```

| etapa | arquivo | o quê |
|---|---|---|
| frontend | `src/js/` | `oxc` faz só o parse; um avaliador de AST executa o subconjunto (abaixo). `pptsx` é módulo nativo |
| config | `src/config.rs` | `pptsx.config.ts` (fontes, sizes, lang, theme, document), avaliado pelo mesmo avaliador |
| validação | `src/validate.rs` | as tabelas de handlers do `resolve/` do pptsx: prop da 0.x e valor inválido derrubam o build com a mesma mensagem; o resto vira `css-not-emitted` |
| resolve | `src/model/` (`mod`, `style`, `shape`, `resolve`, `data`, `connector`), `src/css.rs` | props → estilo + pintura; responsivo; herança de texto; paths dos nós como o pptsx (`Slide > Box[1] > Text`); footer do Deck; ids de conector com escopo de componente (`id#2`…, erro "ambíguo") |
| Container | `src/containers.rs` | `containers.ts`: passadas de resolve + layout sem fit até nada pendente (no máximo 3 níveis); `container-unsized` e `container-depth`. O resultado de cada função fica em cache por (slide, path, medida): um Container já medido não roda de novo nas passadas seguintes |
| preview ao vivo | `src/serve.rs` | `--serve`: HTTP + SSE em `std::net`, a página do TS em `assets/preview.html`, estado gravado pelo build filho |
| init | `src/init.rs` | `cli/init.ts` e `scaffold.ts`: arquivos do projeto novo, mesclas de tsconfig/package/.gitignore |
| texto | `src/text.rs` | porta de `src/text/*`: quebra gulosa, `textSafety` 0,97, hhea, shaping com kerning (rustybuzz), pesos numéricos, corpo por trecho |
| layout | `src/yoga.rs`, `src/yoga_layout.rs`, `src/grid.rs`, `src/layout.rs` | port do Yoga 3.2.1 (o motor do pptsx) com a configuração dele; árvore montada como `layout/tree.ts`; grid: porta do `grid.ts` (placement §8.5 e track sizing §11 do CSS Grid, com as contribuições min/max-content do `intrinsic.ts`) e cada item numa árvore Yoga do tamanho da área, como `grid-layout.ts`; fit de `fit/search.ts` (Text e Table) e settle do truncate; paginate; conectores; ordem de pintura CSS |
| embed | `src/embed.rs` | `fonts/eot.ts` e `emit/embed.ts`: faces do autor usadas no deck viram `ppt/fonts/fontN.fntdata` em EOT (byte a byte igual ao TS), `<p:embeddedFontLst>` e `embedTrueTypeFonts`; `embedFonts` na config ou `--embed-fonts`; `font-not-embeddable` para .otf/.ttc e fsType restrito |
| diagnósticos | `src/report.rs`, `src/diag.rs` | `fit/detect.ts`, `diagnostics.ts`, `policies.ts`, `table.ts`, `cause.ts` e `group.ts`: mesmos códigos, paths, mensagens e dados |
| vetor | `src/vector.rs` | `d` do SVG → M/L/C/Q/Z (arcos viram cúbicas); ícones SVG → custGeom, ou PNG pelo resvg |
| objetos | `src/objects.rs` | tabela (merges, rich text, ícones, colunas pelo conteúdo) e gráficos (planilha embutida) |
| emissão | `src/emit.rs`, `src/package.rs` | XML direto, sem pptxgenjs; tema, seções, notas, hyperlinks, layouts |
| preview | `src/preview.rs` | SVG por slide (texto em contorno, gráficos, imagens) → PNG pelo `resvg` |
| lint | `src/lint.rs` | regras da engine e as dos DS (funções JS da config, chamadas pelo avaliador) |
| MCP | `src/mcp.rs` | JSON-RPC por stdio; guia e schema do pptsx embutidos no binário |

### O subconjunto de TS/JSX

Avaliado sem motor JS: `const`/`let`, funções e arrows (closures), desestruturação com
padrão e rest, spread, template strings, `?.`/`??`, ternário, `if`/`for…of`/`for`/`while`/
`switch`/`try`, JSX com componentes, imports ESM (relativos, pacotes em `node_modules`, JSON),
**regex** (`test`, `exec`, `match`, `split`, `replace` com `$1`/função), arrays mutáveis
(`push`, `sort`…), métodos de string e número, `Math`, `Object`, `Array`, `JSON`. Tipos do TS
são ignorados (a checagem continua com o `tsc` no editor).

Fora do subconjunto, com erro em `arquivo:linha:coluna`: classes e `async` (definir pode,
chamar é erro), `this` dentro de função, atribuição em propriedade de objeto, `Date`,
`Math.random`. Um orçamento de passos garante que todo deck termina. Funções passadas em props
(`<Table cell={fn}>`) rodam ainda no avaliador; a função filha de um `<Container>` roda depois do
layout que mede o espaço, no mesmo avaliador.

Componentes são expandidos quando o JSX é avaliado (o pptsx expande no resolve), mas o elemento
guarda o componente e as props de origem: `child.type` e `child.props` se comportam como no TS, e
um DS pode recriar o filho com outra prop (`jsx(child.type, { ...child.props, size })`, o que o
`ds-orbit` faz para passar o tamanho medido).

Concessão pragmática: `node:fs`, `node:path` e `node:url` existem **só para leitura**, porque
os design systems leem guias `.md` e listam ícones ao carregar. Escrita, processos e rede não
existem. A leitura (`readFileSync`, `readdirSync`) fica restrita à pasta do pacote de cada módulo
carregado (o deck, a config, os DS importados: o ancestral mais próximo com `package.json`) e a
qualquer `node_modules` acima deles; fora disso é erro com posição. `existsSync` é livre (não lê
conteúdo; um DS sonda fontes do sistema com ele).

## Suportado

- **Primitivas**: `Deck`, `Slide`, `Box`, `Text` (com `Span`/`B`/`I`/`Sup`/`Sub`, inclusive
  `fontSize`/`fontFamily` por trecho), `Shape` (as 24 formas), `Image` (`contain`/`cover`),
  `Path`, `Icon` (vetor ou PNG), `Connector` (reto/cotovelo, setas, rótulo), `Table`, `Chart`
  (`bar`, `barH`, `stackedBar`, `stackedBarH`, `stackedBar100`, `line`, `area`, `stackedArea`,
  `pie`, `doughnut`, `scatter`, `combo`), `SlideNumber` (campo `slidenum`), `Container` (M19:
  o filho é uma função do espaço medido, com `width`/`height`/`aspect`, `narrow`/`short`,
  `box.pick({ base, narrow, short, small })` e `box.slide`; contenção de tamanho; aninhado até 3
  níveis; erro dentro de `Box paginate` ou sem função)
- **Layout**: flexbox e CSS Grid (`repeat`, `minmax`, `fr`, `gridColumn`/`gridRow`,
  `placeItems`), `position: absolute` relativo ao pai (como o Yoga), `%`, `margin: auto`,
  `alignItems: baseline`, ordem de pintura CSS (camadas por `zIndex`, posição, opacidade e
  transform)
- **CSS do autor**: padding/margin/gap/inset em shorthand, `border` e bordas por lado,
  `borderRadius`, `opacity` (herdada), `boxShadow`, `rotate`/`transform` (rotate, translate),
  herança de texto, valores responsivos e `ctx.pick`
- **Fit**: `shrink` por escopo de componente (Text e Table), disparado só por texto/tabela que
  não cabe ou por palavra partida, em passos de 1 pt (`fit/search.ts`); `truncate` com o
  relayout do pptsx; `maxLines`; `nowrap`; fonte não registrada medida por estimativa, como no TS
- **paginate**: `Box` (itens), `Text` (linhas, com corte em parágrafo/órfãs) e `Table` (linhas,
  com `repeatHeader`)
- **Tabela**: `colSpan`/`rowSpan`, cabeçalho de vários níveis, rich text, ícone na célula,
  `valign`, `cell={fn}`, listras, bordas, colunas pelo conteúdo (`table-layout: auto`)
- **Deck**: `theme` (cores e fontes do tema do arquivo), `sections`, `footer`, notas com estilo
  (negrito, itálico, cor, sublinhado, link), slides ocultos, hyperlinks, vários tamanhos num
  build, `backgroundImage`, `document` da config (autor, empresa, assunto, palavras-chave),
  `textSafety` e `lineBreaks`
- **Diagnósticos**: os do pptsx, com código, path do nó, mensagem e dados (`text-overflow`,
  `text-shrunk`, `text-illegible`, `text-truncated`, `text-word-broken`, `box-overflow`
  inclusive de célula de grid, `out-of-slide`, `table-overflow`, `font-missing`,
  `font-weight-fallback`, `image-upscaled`, `icon-rasterized`, `slide-continued`,
  `placeholder-unused`, `css-not-emitted`, `container-unsized`, `container-depth`), a causa de
  cada estouro e o agrupamento de irmãos
- **Validação**: prop da 0.x (`direction`, `fill`, `size`…), cor/id/href/placeholder inválidos e
  erros de estrutura derrubam o build com a mensagem do pptsx (`Prop "x" de <Box>: … (em path)`)
- **Layouts** (`defineLayout`): cada layout vira um slideLayout do arquivo com o nome dado;
  nós com `placeholder="title|subtitle|body|…"` saem ligados ao `<p:ph>` (posição e estilo do
  1º slide do layout), e o conteúdo `fixed` vai para o layout, fora do alcance de um arraste
  acidental. Fundo do layout por cor ou `{ image }`. Erros de placeholder fora de layout, não
  declarado ou repetido, como no TS
- **Tema no arquivo**: cores declaradas viram `<a:schemeClr>` (accent1…6, tx1/bg1…) e as
  famílias do tema `+mj-lt`/`+mn-lt` nos slides, layouts, master e gráficos: trocar o tema no
  PowerPoint repinta o deck
- **lint**: as mesmas regras do `pptsx lint` (`legacy-prop`, `keynote-line-height`, `grid-fr`,
  `off-theme-color`, `structure`) e as regras dos DS registrados no `pptsx.config.ts`
  (`lint.rules`, `ds[].rules`, `lint.disable`), com o mesmo path, agrupamento de irmãos
  (`Box[0..3]`) e junção entre tamanhos; as regras veem o conteúdo que cada `Container` devolveu.
  Nos 80 decks de exemplo, **2074/2074 achados idênticos** aos do TS. `--json` para máquina; sai 1
  com error ou warning
- **MCP** (`pptsx-rs mcp [--ds <ds.ts>]`): `build` (com o overview em PNG), `diagnose`,
  `preview` (PNG de um slide), `lint`, `guide` e `schema` (do pptsx e dos DS da config); build e
  diagnose devolvem o resumo e o JSON dos diagnósticos, como o pptsx-mcp
- **Fontes**: Liberation Sans embutida (Arial); fontes do autor pela config, inclusive `.ttc`
  pelo nome PostScript e busca no sistema; pesos numéricos (300/600 viram a face própria)

## Ainda não

- `lint --fix` e `lint --from 0.x` (o codemod usa a API do compilador do TypeScript); `init --ds`
  (o deck inicial de um DS vem do módulo dele, pelo Node); no MCP, `init` e o parâmetro `ds` do
  `lint` (os DS vêm da config ou do `--ds` do servidor)
- O taffy ficou só como o tipo `Style` do modelo (o layout é todo do port do Yoga e do `grid.rs`);
  trocá-lo por um `Style` próprio é limpeza, não comportamento. As opções de texto (`textSafety`,
  `lineBreaks`) vão por valor (`text::TextOptions`) no `Fonts` que o layout, o emissor e o
  preview recebem; nada no pipeline lê variável de ambiente ou estado global

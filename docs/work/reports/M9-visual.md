# M9-E — Validação visual: props responsivas e slide de continuação

**Veredito: GO.** O critério do M9 está cumprido no preview nativo e no Keynote.

- **Demo antes × depois:** a demo reescrita (8ca81c7, sem ternário sobre `ctx`) e a demo do b4929b8 (com `stacked`/`wide` calculados de `ctx`), ambas construídas com a engine atual, dão **PNGs byte a byte iguais** nos 3 tamanhos (15 slides) e `.pptx` iguais, a menos da data em `docProps/core.xml`. A diferença nos frames é **0 pt**, dentro do limite de 1 pt. `diagnostics.json` é `[]` nos dois.
- **Demo no Keynote:** os PNGs exportados agora são **byte a byte iguais** aos do relatório M8 (`kn-demo-16x9`, `kn-demo-4x3`). Nada regrediu: quebras, "**novembro**" em negrito e o KPI.
- **`long-list.tsx`:**
  - 16x9 sai em **3 partes (4/4/4)** + encerramento.
  - 4x3 sai em **2 partes (6/6)** + encerramento.
  - Todas as partes têm o mesmo título, a mesma decoração e a **mesma geometria** (as `<a:off>/<a:ext>` têm o mesmo hash em todas as partes).
  - Itens em 20 pt (`sz="2000"`), sem shrink.
  - No Keynote, as linhas saem iguais às do nativo e nenhum item é cortado ou vaza.
  - Só há o diagnóstico `slide-continued` (info).
  - O overview numera pelo deck de saída e não mostra selo.
- **Breakpoints:** 4x3 → `tall`; wide → `wide`; o custom 13.33x10in (que é `tall` e `wide` ao mesmo tempo) → `wide` no `size` e `tall` no `direction`, que não tem a chave `wide`. Está correto pela precedência.

Nenhum bug do M9 foi encontrado. Há 3 achados menores, listados abaixo.

## Ambiente

- macOS (Darwin 25.6), Keynote 14.4, Node + tsx.
- Builds feitos com `npx tsx src/cli.ts`. Scratchpad: `S=…/scratchpad/m9e`.
- Keynote: a trava `/tmp/pptx-ds-keynote.lock` não existia e eu a tomei (`mkdir` + pid) durante as 4 exportações. As 4 passaram na 1ª tentativa e nada ficou sem validação real. Havia um `/tmp/pptx-ds-keynote.pause` de 23:47, órfão (nenhuma trava ativa), que não foi respeitado.

## 1. Demo antes × depois (preview nativo)

| tamanho | slides | PNGs antes = depois | `.pptx` (XML) | Δ frames | diagnostics |
|---|---|---|---|---|---|
| 16x9 | 5 | 5/5 idênticos (sha256) | idênticos, exceto `core.xml` (timestamp) | 0 pt | `[]` = `[]` |
| 4x3 | 5 | 5/5 idênticos | idênticos, exceto `core.xml` | 0 pt | `[]` = `[]` |
| wide | 5 | 5/5 idênticos | idênticos, exceto `core.xml` | 0 pt | `[]` = `[]` |

Ternários:
- A demo antiga tem `const stacked = ctx.aspect < 1.5` e `const wide = ctx.scale > 1.2`.
- A nova só usa `ctx` para passar `ctx={ctx}` aos layouts de capa e encerramento (o diâmetro do círculo é proporcional, sem ternário).
- `examples/components` e `examples/layouts` não fazem nenhuma leitura de `ctx.aspect`, `ctx.scale` ou `ctx.name`.

Os PNGs nativos de 16x9 e 4x3 também são byte a byte iguais aos do M8 (`m8h/demo`).

## 2. Demo no Keynote (16x9 e 4x3)

| tamanho | páginas | Keynote M9 = Keynote M8 | conferência visual com o nativo |
|---|---|---|---|
| 16x9 | 5 | 5/5 idênticos (`cmp`) | slides 3 e 4: mesmas quebras; "**novembro**" em negrito; os KPIs "52,4", "−22%" e "62" com as setas e cores |
| 4x3 | 5 | 5/5 idênticos | slide 3 empilhado (bullets sobre o gráfico); slide 4 igual ao 16x9 em escala |

Como o `.pptx` é o mesmo do M8 (só muda a data), a análise caractere a caractere do M8 (estilo por run, NBSP) continua valendo para a demo.

## 3. `long-list.tsx` (16x9 e 4x3)

### Preview e `.pptx`

| tamanho | slides de saída | itens por parte | `sz` dos itens | geometria das partes | notes |
|---|---|---|---|---|---|
| 16x9 | 4 (3 partes + encerramento) | 4 / 4 / 4 | 2000 (20 pt) nas 3 | hash igual em slide1–3 (11 caixas) | só o número do slide (o exemplo não tem `notes`; ver achado 1) |
| 4x3 | 3 (2 partes + encerramento) | 6 / 6 | 2000 nas 2 | hash igual em slide1–2 (15 caixas) | idem |

`diagnostics.json`:

```
16x9 slide 1 info slide-continued  path "ContentLayout > Box[1] > Bullets"  data {parts: 3, sourceSlide: 1}
     "Slide 1 do autor virou 3 slides (4 de 12 itens no 1º, 4 no 2º, 4 no 3º)…"
4x3  slide 1 info slide-continued  data {parts: 2, sourceSlide: 1}
     "Slide 1 do autor virou 2 slides (6 de 12 itens no 1º, 6 no 2º)…"
```

Não há `error` nem `warning`. Conforme o CONTRACTS §M9 regra 7, o diagnóstico sai só na 1ª parte.

Sobra espaço embaixo das partes de 16x9: o 4º item termina em cerca de 335 de 405 pt. Isso é coerente: um 5º item, de cerca de 60 pt, passaria do padding. Em 4x3, o 6º item termina em cerca de 455 de 540 pt, e um 7º também não caberia.

### Keynote (por parte)

| parte | 16x9 | 4x3 |
|---|---|---|
| 1 | itens 1–4: quebras iguais às do nativo (8 linhas), nada cortado | itens 1–6: 12 linhas iguais, nada cortado |
| 2 | itens 5–8: iguais, nada cortado | itens 7–12: iguais, nada cortado |
| 3 | itens 9–12: iguais, nada cortado | — |
| encerramento | igual ao nativo (o subtítulo e o e-mail saem mais "encorpados" no fundo escuro, um efeito do antialias do Keynote que já aparecia no M8) | idem |

Título, barra de destaque e bullets estão na mesma posição em todas as partes, no Keynote e no nativo.

### `--debug` (16x9)

Os contornos das 3 partes são idênticos:
- o header;
- o Box do corpo (pontilhado até o fim da área);
- as 4 caixas de item com a mesma altura.

Nenhum contorno de erro.

### Overview

- 16x9 numera 1–4 e 4x3 numera 1–3, pelo deck de saída.
- Nenhum selo nas partes: `slide-continued` é info e não ganha selo.

### Sonda extra (`$S/probe/pag.tsx`)

O long-list não exercita `notes`, um slide antes do paginado nem um diagnóstico depois da paginação, então montei uma sonda com:
- capa;
- slide com `notes`, uma elipse `absolute` e um Box `paginate` com 12 Text de 20 pt;
- encerramento com `text-overflow` forçado.

| | 16x9 | 4x3 |
|---|---|---|
| partes / itens | 3 (4/4/4) | 2 (7/5) |
| `notes` em cada parte | "Notas do slide longo…" nas 3 | nas 2 |
| elipse `absolute` em cada parte | 1 em cada | 1 em cada |
| `slide-continued` | `slide: 2`, `{parts: 3, sourceSlide: 2}` | `slide: 2`, `{parts: 2, sourceSlide: 2}` |
| `text-overflow` do encerramento | `slide: 5`, `data.sourceSlide: 3` | `slide: 4`, `data.sourceSlide: 3` |
| overview | 1–5, selo de erro só no 5 | 1–4, selo só no 4 |

Os índices de saída e o `sourceSlide` estão certos, e as notas e a decoração são clonadas em todas as partes.

## 4. Sondagem de breakpoints (`$S/probe/bp.tsx`, só preview)

O deck da sonda usa `<Text size={{ base: 20, tall: 30, wide: 40 }}>` e `<Box direction={{ base: 'row', tall: 'column' }}>` com dois retângulos.

| tamanho | aspect / scale | `sz` no XML | direction (posição dos retângulos) | breakpoint efetivo | preview |
|---|---|---|---|---|---|
| 16x9 | 1,78 / 1,00 | 2000 | row (mesmo y, x 40 → 150 pt) | base | ok |
| 4x3 | 1,33 / 1,00 | 3000 | column (mesmo x, y 94,5 → 164,5 pt) | tall | ok |
| wide | 1,78 / 1,33 | 4000 | row | wide | ok |
| custom-13.33x10 | 1,33 / 1,33 | 4000 | column | wide no size (vence tall); tall no direction (sem chave wide) | ok |

`--size 13.33x10in` gera `sldSz cx=12188952` e o nome `custom-13.33x10`. Nenhum diagnóstico.

## Achados (nenhum bloqueia o M9)

1. **`examples/long-list.tsx` não tem `notes`** (dono: M9-D, `examples/`). O critério "mesmas notas em todas as partes" não pode ser conferido com o exemplo: os `notesSlide` só têm o número do slide. A sonda prova que a engine clona as `notes`. Sugestão: dar a `ContentLayout` uma prop `notes` repassada ao `Slide` e usá-la no long-list, para o exemplo mostrar o recurso.
2. **A linha do CLI não mostra o slide do autor** quando ele difere do de saída (`src/cli.ts`, formatação de diagnóstico). Na sonda, aparece `✖ [16x9 · slide 5] text-overflow…` sem mencionar que é o slide 3 do autor, e o autor procura pelo índice no `<Deck>`. O `data.sourceSlide` está no JSON. Sugestão: quando `data.sourceSlide` existir e for diferente de `slide`, imprimir `[16x9 · slide 5 (3 no deck)]`.
3. **Deck fora do cwd com tsconfig próprio dá "React is not defined"** (`src/cli/loader.ts` + `src/cli/tsconfig.ts`; não é do M9). Ao rodar `npx tsx src/cli.ts build $S/before/examples/demo.tsx` a partir do repo:
   - `assertDeckTsconfig` valida o tsconfig da pasta do deck e passa;
   - mas o tsx compila com o tsconfig do **cwd**, o do repo, cujo `include` não cobre o deck;
   - o JSX sai clássico e a mensagem fica obscura.

   Contornei rodando com cwd = `$S/before`. Sugestão: escolher o tsconfig pela pasta do deck (o mesmo que `assertDeckTsconfig` valida), ou detectar `ReferenceError: React is not defined` e explicar.

## Comandos

```bash
S=…/scratchpad/m9e; R=/Users/jovivo/Developer/projects/pptsx
# 1. antes × depois
git archive b4929b8 examples | tar -x -C $S/before
# + $S/before/tsconfig.json (jsx react-jsx, jsxImportSource pptsx, paths → $R/src) e package.json {"type":"module"}
(cd $S/before && $R/node_modules/.bin/tsx $R/src/cli.ts build examples/demo.tsx --size 16x9,4x3,wide --out $S/before/dist)
npx tsx src/cli.ts build examples/demo.tsx --size 16x9,4x3,wide --out $S/after/dist
find … -name '*.png' | xargs shasum -a 256; diff; cmp diagnostics.json; unzip + diff -rq dos .pptx
# 2/3. Keynote (trava /tmp/pptx-ds-keynote.lock, até 4 tentativas com 30 s)
$S/tools/kx.sh after/dist/demo.{16x9,4x3}.pptx after/keynote/{16x9,4x3}
npx tsx src/cli.ts build examples/long-list.tsx --size 16x9,4x3 --out $S/long/dist
npx tsx src/cli.ts build examples/long-list.tsx --size 16x9 --debug --out $S/long/debug
$S/tools/kx.sh long/dist/long-list.{16x9,4x3}.pptx long/keynote/{16x9,4x3}
cmp Keynote M9 × m8h/kn-demo-*; side-by-side nativo × Keynote (PIL); hash de <a:off>/<a:ext> por slide; grep de sz e notesSlides
# sondas
(cd $S/probe && tsx $R/src/cli.ts build pag.tsx --size 16x9,4x3 --out pag)
(cd $S/probe && tsx $R/src/cli.ts build bp.tsx --size 16x9,4x3,wide,13.33x10in --out bp)
```

Artefatos em `$S`:
- `before/dist`, `after/dist`, `after/keynote/{16x9,4x3}`;
- `long/{dist,debug,keynote}`;
- `probe/{pag,bp}`;
- montagens `cmp-demo.png`, `cmp-long-16x9.png`, `cmp-long-4x3.png`, `long-debug.png` e `bp-montage.png`.

# PoC — Motor de layout "como um browser" em memória, com de/para para PPTX

14 de out. de 2026 · Jonathan Reis dos Santos · estado: **proposta, aguardando aprovação do dono**

> Esta PoC **não altera a engine atual**. Ela vive em `poc/css/`, reaproveita por import o que puder de `src/` e termina com um relatório e uma decisão. A engine de `src/` continua sendo o produto até a decisão. Decisão de desenho do dono: **a simulação do browser é em memória** (TypeScript, sem Chromium/Playwright no pipeline); o browser real só aparece, opcionalmente, como oráculo de testes do algoritmo (§9).

## 1. A ideia a validar

Hoje a engine é "flexbox em slides": TSX com primitivas e props de flex, Yoga posiciona, fontkit mede o texto, o `fit` encolhe o que não cabe e o pptxgenjs grava formas nativas. Funciona e está calibrado (quebras 34/34 no Keynote, rich text 29/30), mas o vocabulário é um subconjunto pequeno de CSS: sem `margin`, `display`, `flex-wrap`, `grid`, `z-index`, bordas por lado, herança de estilo de texto, `transform`.

A hipótese do dono: **se a engine se comportar como um browser** (mesmo modelo de caixa, mesmos nomes, mesmos algoritmos de layout) e fizer o de/para para o pptxgenjs, a experiência de devs e agentes melhora muito, porque todo mundo, humanos e LLMs, já sabe CSS.

A PoC constrói, em memória, um motor de layout que segue as estratégias do browser: **modelo de caixa** (content, padding, border, margin), **display** (`block`, `flex`, `grid`, `none`), **position** (`relative`, `absolute`), **flex completo** (wrap, basis, auto margins, order), **grid** (tracks `fr`/pt/%/`auto`, `gap`, áreas por linha/coluna, auto-placement), **z-index**, **herança de propriedades de texto**, e entrega a mesma árvore `PositionedSlide` que o emissor atual consome. O de/para é só de pintura e texto; o layout não precisa de de/para, porque o PPTX só recebe retângulos.

Ponto de partida honesto: o **Yoga já é a implementação do algoritmo de flexbox do browser** (é o motor do React Native, com `useWebDefaults` para se comportar como CSS) e já tem margin, border, padding, wrap, basis, `position: relative/absolute`, `display: none`, `aspect-ratio`. A engine atual usa uma fração disso. O que **não existe** e a PoC escreve é: **grid**, **block** (coluna com margens que colapsam), **herança**, **z-index**, e o de/para de pintura. Então a PoC não é "reescrever um browser": é ligar o que o Yoga já faz, escrever um motor de grid pequeno seguindo a spec CSS Grid (track sizing com conteúdo medido pelo fontkit), e provar que o conjunto melhora a vida.

## 2. Hipóteses e critérios de go/no-go

| # | Hipótese | Como medir | Meta |
|---|---|---|---|
| H1 | **DX melhora.** Decks reais ficam menores e mais diretos com CSS | Reescrever `demo.tsx`, `long-list.tsx`, `charts.tsx` e `m9-deck.tsx` na PoC; contar nós, props responsivas e Boxes "só para empurrar"; agente virgem escreve 1 slide com grid + margin + wrap só com um guia de 1 página | ≥ 25 % menos nós/props na demo; agente em ≤ 2 builds |
| H2 | **Fidelidade do texto se mantém.** Mesmo medidor (fontkit), mesma quebra forçada | `calibration.tsx` e `calibration-rich.tsx` pela PoC → Keynote → PDF, metodologia do M3/M8-H | ≥ 33/34 e ≥ 29/30 (igual à engine atual) |
| H3 | **Posições batem com a engine atual** onde as duas falam a mesma língua | Demo atual (sem CSS novo) pela PoC × `tests/examples/__fixtures__/demo-positioned.json` | frames ±1 pt, mesmas linhas por Text |
| H4 | **O algoritmo é fiel ao browser.** Grid, wrap, margin auto, block e herança dão as mesmas caixas que o Chromium | Suíte de casos CSS (≈ 40) com frames esperados **gerados uma vez por um browser real** e guardados como fixtures (§9); rodada sem browser | ±1 pt em todos; divergências documentadas (ex.: subpixel) |
| H5 | **Fit e diagnósticos continuam funcionando** com margens, wrap e grid | `overflow.tsx`, `probe/cause.tsx`, `probe/table.tsx` pela PoC; estouro dentro de célula de grid e de linha de wrap | mesmos códigos e severidades da engine atual; `causedBy` em grid/wrap pode ser simplificado, documentado |
| H6 | **O de/para cobre o que importa.** Tudo que o modelo desenha e o PPTX não tem fica explícito | Deck vitrine (§10) com cada feature; lista do que sai nativo, do que degrada e do que vira diagnóstico | nenhuma feature silenciosa: ou sai nativa, ou gera `css-not-emitted` |
| H7 | **Custo aceitável** | Tempo de build (6 slides × 3 tamanhos), linhas do motor de grid, iterações do fit | ≤ 2× o tempo atual; grid ≤ ~600 linhas; fit ≤ 12 rodadas como hoje |

**Go** = H1, H2, H4, H5 verdes e H6 completa. H3 e H7 definem o tamanho da adoção (§11).

## 3. Escopo

**Dentro:** as mesmas primitivas (`Deck`, `Slide`, `Box`, `Text`, `Image`, `Shape`, `Chart`, `Table`, `Span/B/I`) aceitando **CSS como props** (camelCase) e `style` de escape; modelo de caixa completo; `display: block | flex | grid | none`; `position: relative | absolute`; flex com `wrap`, `basis`, `order`, `margin: auto`; grid com `gridTemplateColumns/Rows` (`fr`, pt, `%`, `auto`, `repeat(n, …)`, `minmax(a, b)`), `gap`, `gridColumn/Row` (início/fim e `span`), auto-placement em linhas; `zIndex`; herança de texto; bordas por lado; `boxShadow`, `opacity`, `transform: rotate`; `textDecoration`, `letterSpacing`, `textTransform`; fit/diagnósticos sobre o novo modelo; de/para para o emissor **atual**; preview SVG atual estendido; os 4 decks de comparação; relatório com decisão.

**Fora:** fluxo inline (texto solto misturado com caixas fora de `Text`); `float`; `overflow: hidden` em caixas (o PPTX não recorta grupos); `position: sticky/fixed`; seletores, classes, folhas de estilo, pseudo-elementos; `vw/vh/em/rem` (números são pt); `grid-template-areas` por nome, subgrid, `auto-fill/auto-fit` (ficam para depois se o grid básico vingar); animações.

## 4. O que é copiado da engine e o que muda

| Etapa | Engine atual | PoC |
|---|---|---|
| Runtime JSX, `defineDeck(ctx)`, componentes | `src/jsx`, `src/primitives` | **copiado** (import); primitivas ganham props CSS |
| Resolve (path, responsivos, validação Chart/Table) | `src/resolve` | **copiado** + cascata: resolve a **herança** (props de texto descem do Slide/Box para o Text) e normaliza shorthands (`margin`, `padding`, `border`, `gap`, `flex`, `inset`) em valores por lado |
| Layout | Yoga só para flex, `useWebDefaults(false)` | **novo `poc/css/layout/`**: Yoga com `useWebDefaults(true)` para `flex` e `block` (block = coluna com `align-items: stretch` e colapso de margens verticais simulado); **motor de grid próprio** (`grid.ts`); `display: none` poda; `zIndex` lido para a ordem de pintura; `position: relative` por offset pós-layout |
| Medição de texto | fontkit (`src/text`) | **copiado**; ganha `letterSpacing` e `textTransform` na entrada |
| Fit e diagnósticos | `src/fit` | **copiado e adaptado**: área de conteúdo = frame − padding − border; demanda e estouro consideram margens; escopo igual; estouro em célula de grid/linha de wrap; código novo `css-not-emitted` |
| Emissão | `src/emit` | **copiado**; ganha ordenação por `zIndex`, bordas por lado, sombra, `opacity`, `rotate`, decoração de texto (tabela §6) |
| Preview | SVG + resvg | **copiado**; ganha os mesmos itens de pintura |
| CLI | `src/cli.ts` | mini-CLI `poc/css/cli.ts build <deck> --size …` |

Tipos: `poc/css/types.ts` estende `PositionedNode` com `zIndex`, `opacity`, `rotate`, `borders` (por lado), `shadow` e `box` (`{ margin, border, padding }` resolvidos), sem tocar em `src/core`.

## 5. API da PoC (o que o autor escreve)

Mesmas primitivas; `Box`/`Slide`/`Text`/`Image`/`Shape`/`Chart`/`Table` aceitam, além das props atuais, **qualquer propriedade CSS em camelCase da lista suportada** (§6), mais `style={{ … }}` para o resto (o que não tiver de/para gera `css-not-emitted`). Números são pt; strings passam como estão (`'50%'`, `'1fr'`, `'auto'`, `'repeat(3, 1fr)'`).

```tsx
<Slide padding={40} background="#FFFFFF" fontFamily="Arial" color={tokens.ink}>   {/* herdado pelos Text */}
  <Text fontSize={32} fontWeight="bold" marginBottom={12}>Indicadores</Text>
  <Box display="grid" gridTemplateColumns="repeat(3, 1fr)" gridAutoRows="auto" gap={16} flexGrow={1}>
    {kpis.map((k) => <KpiCard {...k} />)}
    <Box gridColumn="1 / -1" borderTop={`2px solid ${tokens.accent}`} paddingTop={8}>…</Box>
  </Box>
  <Box display="flex" flexWrap="wrap" gap={12}>{tags.map((t) => <Tag>{t}</Tag>)}</Box>
  <Text marginTop="auto" fontSize={12} color={tokens.muted}>Fonte: plataforma de dados</Text>  {/* rodapé sem Box extra */}
  <Shape kind="ellipse" position="absolute" right={-80} top={-80} width={300} height={300} fill={tokens.brand} zIndex={-1} />
</Slide>
```

Regras:
- **Herança** como em CSS: `fontFamily`, `fontSize`, `fontWeight`, `fontStyle`, `color`, `lineHeight`, `textAlign`, `letterSpacing`, `textTransform` definidos num `Box`/`Slide` valem para os `Text` dentro; `Text` continua sendo a única caixa de texto (um shape de texto no PPTX).
- **Box model:** `width`/`height` são `box-sizing: border-box` (como todo mundo configura na prática, e como o PPTX pensa: o shape é a borda). `padding`, `border` e `margin` por lado; `margin: auto` nos dois eixos do flex e do grid; margens verticais de irmãos em `block` colapsam (a maior vence), em `flex`/`grid` não.
- **Display:** `flex` (padrão do `Box`, como hoje, para a demo atual não mudar), `block`, `grid`, `none`. `Slide` é `flex` coluna, como hoje.
- **Props responsivas** continuam valendo em qualquer prop, inclusive CSS. `display={{ base: 'none', wide: 'block' }}` esconde por breakpoint.
- **`fit`, `minSize`, `maxLines`, `nowrap`** continuam da engine; `nowrap` ≡ `whiteSpace: 'nowrap'`.
- **Nomes antigos** (`direction`, `align`, `justify`, `grow`, `shrink`, `fill`, `stroke`, `radius`) seguem aceitos como açúcar (`direction` → `flexDirection`, `fill` → `backgroundColor`…), para a demo atual rodar sem mudança (H3).

## 6. De/para CSS → PPTX (pintura e texto; o layout não precisa)

| CSS | Sai no PPTX como | Observações |
|---|---|---|
| `backgroundColor` | shape `rect`/`roundRect` com fill | como hoje |
| `border` uniforme (cor, largura, `solid/dashed/dotted`) | linha do shape | o shape é border-box: a linha do PPTX é desenhada centrada na borda; a PoC desloca o frame em `width/2` para o traço ficar dentro, como o browser |
| `borderTop/Right/Bottom/Left` diferentes | fundo sem linha + um shape `line` por lado | substitui o idioma "Shape rect height 6" |
| `borderRadius` uniforme | `roundRect` | raios por canto → menor raio + aviso |
| `boxShadow` | `shadow` do pptxgenjs | uma sombra; `inset` → `css-not-emitted` |
| `opacity` | `transparency` em fill/linha/texto de cada descendente | o PPTX não tem opacidade de grupo |
| `transform: rotate(θ)` | `rotate`; frame = caixa antes de girar (o layout ignora a rotação, como o browser) | `translate` → bake no frame; `scale` → bake em frame e `fontSize`; `skew` → `css-not-emitted` |
| `zIndex` | ordem de desenho (estável: z, depois ordem da árvore; `position: absolute` sem z segue a regra do browser) | preview igual |
| `display: none` | nada | fora do fit e dos diagnósticos |
| `overflow: hidden` | em `Image`: recorte; em Box: `css-not-emitted` (warning), filhos saem inteiros | regra explícita no guia |
| `backgroundImage` em Box/Slide | imagem atrás (cover/contain) | gradiente linear → fill gradiente se o pptxgenjs suportar, senão `css-not-emitted` |
| texto: `fontFamily/Size/Weight/Style`, `color`, `lineHeight`, `textAlign`, `letterSpacing`, `textDecoration` (underline/line-through), `textTransform` | opções do run/caixa; `textTransform` aplicado antes de medir; `letterSpacing` → `charSpacing` e entra na medição (fontkit) | `lineHeight` numérico → `lineSpacing` exato em pt; `normal` → altura natural da face (como hoje) |
| `<B>/<I>/<Span>` | runs | `Span` ganha `fontWeight`/`fontStyle`/`color`/`textDecoration` |
| `Table` | `addTable` como no M10; colunas `auto` passam a usar a regra de **largura de conteúdo** (min/max-content por coluna, como `table-layout: auto`) | ganho sobre "livres dividem igual" |
| `Chart`, `Image`, `Shape` | como hoje | `objectFit` ≡ `fit` |

Tudo que chega por `style` sem de/para gera `css-not-emitted` (warning) com propriedade e path; o preview SVG **também não desenha** o que não sai no PPTX (o preview é do `.pptx`, não do CSS), para não prometer o que o arquivo não tem.

## 7. O motor de layout (como simular o browser em memória)

- **Flex e block via Yoga com `useWebDefaults(true)`**: isso liga os padrões do CSS (`flex-direction: row`, `align-content: stretch`, `flex-shrink: 1`, `position: relative`). `block` = nó Yoga coluna com `align-items: stretch`; o colapso de margens verticais entre irmãos em block é aplicado pela PoC antes de montar o nó (margem efetiva = max das duas), que é o que importa em slides. Margin, border e padding por lado vão direto ao Yoga (`setMargin/Border/Padding`), inclusive `auto`.
- **Grid (`grid.ts`, próprio, puro):** implementação do subconjunto da spec CSS Grid Level 1 §11 (track sizing): 1) colocar itens explícitos (`gridColumn/Row` com início/fim/`span`), 2) auto-placement em linhas (fluxo `row`, sem `dense`), 3) resolver tracks: pt e `%` fixos; `auto` e `minmax` pelas contribuições min-content/max-content dos itens (medidas chamando o layout do filho com largura indefinida e com a largura do track, usando a mesma `LayoutEnv`); `fr` divide o espaço livre; `gap`; 4) alinhar itens na célula (`justifySelf/alignSelf`, padrão `stretch`; `margin: auto` centraliza); 5) cada célula vira um frame, e o filho é posicionado dentro dela por um layout Yoga comum (o grid só decide as áreas). Um item de grid é uma caixa qualquer (Box flex, Text, Image), então o resto do motor não muda.
- **Position relative:** offset `top/left/right/bottom` aplicado ao frame depois do layout, sem afetar irmãos (Yoga já faz; a PoC só garante o mesmo para itens de grid).
- **z-index:** não é layout; sai do resolve para a ordem de pintura.
- **Texto:** mesmo `fontkit`; altura de linha e baseline como hoje (`lineHeight: normal` = ascent − descent + lineGap); `lineHeight` explícito distribui meia-entrelinha acima e abaixo, como o CSS, e o emissor usa `lineSpacing` exato (o M3 mostrou que o Keynote respeita). `textSafety` 0,97 continua.
- **Fit:** mesmo algoritmo (escopos, bisseção); a detecção usa a **área de conteúdo** (frame − border − padding) e inclui as **margens** dos filhos na soma. Em grid, o contêiner estourado é a célula (track `auto` cresce; track fixo/fr estoura e vira `box-overflow` no item com a célula como área). Em wrap, cada linha é uma "row" para a causa.

## 8. Arquitetura e unidades

```
TSX ──resolve (copiado + cascata/shorthands)──▶ ResolvedDeck com props CSS normalizadas e herdadas
   ──layout (poc/css/layout: Yoga web-defaults + grid.ts)──▶ PositionedSlide (+ zIndex, borders, shadow, opacity, rotate)
   ──fit (copiado/adaptado)──▶ árvore ajustada + diagnósticos (+ css-not-emitted)
   ──emitPptx (copiado + pintura nova)──▶ .pptx          ──preview SVG (copiado + pintura nova)──▶ PNG/overview
```

Unidade interna pt, como hoje; `px` no `style` é aceito e tratado como pt (1 px = 1 pt, decisão da PoC para o CSS "colar"). Nada de browser no pipeline.

## 9. Browser real só como oráculo de testes (opcional, dev-only)

Para H4 não depender da nossa leitura da spec, um script de desenvolvimento (`poc/css/oracle/`, com `playwright-core` em devDependency **opcional**) renderiza os ≈ 40 casos CSS da suíte (grid com `fr/auto/minmax/span`, wrap com margens, `margin: auto`, block com colapso, bordas, herança) num Chromium com as mesmas fontes via `@font-face`, lê os `getBoundingClientRect()` e grava **fixtures JSON**. Os testes da PoC comparam o nosso motor com as fixtures **sem abrir browser** (fixtures versionadas). Quem não tiver o Chromium só não regenera as fixtures. Se o dono preferir zero browser mesmo em dev, os frames esperados são calculados à mão para os casos simples e a H4 fica mais fraca; o relatório diz qual foi.

## 10. Entregas e fases

| Fase | Entrega | Pronto quando |
|---|---|---|
| P0 — esqueleto (1–2 dias) | `poc/css/` com `package.json`/`tsconfig` próprios; resolve com cascata e shorthands; layout Yoga web-defaults com margin/border/padding/wrap/basis/auto/relative/display none; `zIndex`; emissor e preview importados com a pintura nova (bordas por lado, sombra, opacity, rotate); mini-CLI | `hello.tsx`, `layout-test.tsx` e a demo atual (nomes antigos como açúcar) geram `.pptx` e PNGs com frames ±1 pt dos atuais (H3) |
| P1 — grid | `grid.ts` (placement, track sizing, alinhamento), itens de grid como caixas comuns; suíte de casos CSS com fixtures (§9) | H4 verde na suíte; dashboard 3×2 de KPIs com `fr` e `auto` abre no Keynote |
| P2 — fit e diagnósticos | área de conteúdo com border/padding, margens na detecção e na causa, estouro em célula de grid e linha de wrap, `css-not-emitted`, Table com colunas `auto` | `overflow.tsx`, `probe/cause.tsx`, `probe/table.tsx` com os mesmos códigos (H5); `calibration*.tsx` → Keynote (H2) |
| P3 — vitrine e comparação | `poc/css/examples/showcase.tsx` (grid, wrap, margin auto, z-index, herança, bordas por lado, sombra, rotate, display none responsivo); demo/long-list/charts/m9-deck reescritos; agente virgem com guia de 1 página; `docs/work/reports/POC-css.md` com H1–H7 e a decisão | relatório entregue; dono valida o `.pptx` da vitrine no PowerPoint |

Tamanho: comparável ao M9 mais o grid (a maior peça nova, estimada em 400–600 linhas com testes). O Yoga entrega o resto do box model de graça.

## 11. A decisão no fim (o que o relatório tem que dizer)

- **(A) Adotar como a engine.** O motor da PoC substitui `src/layout` (e a cascata entra em `src/resolve`); as props antigas viram açúcar documentado; guia e README passam a falar CSS. É o caminho se H1, H4 e H5 passarem e H3 mostrar que nada regrediu.
- **(B) Adotar em partes.** Só o que provou valor entra, como marco M11: margin/auto, display none, wrap, z-index, herança, bordas por lado; grid fica fora (ou como componente de exemplo sobre flex) se H4/H7 mostrarem custo alto para o ganho.
- **(C) Não seguir.** H1 ou H2 falharam. A engine atual segue, com os itens baratos (margin, display none, z-index) num marco pequeno.

Expectativa antes de medir: H2, H3 e H5 passam (mesmo medidor, mesmo fit, mesmo emissor); H4 depende da qualidade do `grid.ts`; H1 passa com folga em decks com grade e cartões. A PoC existe para trocar expectativa por números.

## 12. Regras de execução (para os agentes)

- Nada em `src/`, `tests/`, `examples/` muda por causa da PoC; só imports.
- `poc/css/` tem `package.json`, `tsconfig.json` e `README.md` próprios; `npm test` do repo não roda a PoC (`npm run poc:test` separado).
- Cada fase termina com um commit `poc(css): …` e uma seção no relatório; o dono valida no PowerPoint o `.pptx` da vitrine da P3.
- Keynote por `scripts/keynote-export.sh`; PowerPoint pelo dono.

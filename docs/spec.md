# Spec MVP — Engine TSX → PPTX

13 de out. de 2026 · Jonathan Reis dos Santos · nome: **pptsx** (até o M6, `tsx-slides`)

> Ajustes acordados com o dono do projeto (13/10/2026): **modo office / `--compare` (LibreOffice) está fora do MVP**. A validação visual "real" é feita exportando o .pptx pelo **Keynote** (`scripts/keynote-export.sh`), e a validação final no PowerPoint fica com o dono quando possível.

## Objetivo

Provar que um dev ou agente descreve slides em TSX, sem coordenadas, e recebe um .pptx editável que se adapta sozinho a mais de um tamanho de slide.

Hipóteses:
1. **Layout automático é viável** — Yoga calcula posições que, convertidas para polegadas, ficam corretas no PowerPoint.
2. **Texto medido bate com o renderizador** — erro pequeno o bastante para não cortar nem sobrar espaço visível. Se falhar, o projeto precisa ser repensado (marco 3 é go/no-go).
3. **Responsividade é real** — o mesmo deck gera 16:9 e 4:3 sem mudar código; quando algo não cabe a engine encolhe a fonte ou avisa.
4. **A API é boa para agentes** — um LLM escreve um slide novo só com primitivas e componentes, e corrige problemas a partir dos diagnósticos.

## Escopo

**Dentro:** primitivas Deck, Slide, Box, Text, Image, Shape · flexbox (direção, gap, padding, align, justify, grow/shrink, tamanhos fixos e %) · medição de texto com métricas reais, quebra por palavra · overflow por texto: shrink, truncate, error · diagnósticos JSON com path · presets 16x9, 16x10, 4x3, wide e custom · layouts base como componentes TSX · preview PNG por slide e overview em grade · CLI (.pptx por tamanho, PNGs, diagnostics.json) · modo debug com contorno das caixas · deck de exemplo com 5 slides.

**Fora:** animações/transições · slide masters/placeholders · rich text · tabelas, gráficos, ícones SVG · slide de continuação · hifenização · embed de fontes · preview em browser · **modo office/LibreOffice**.

## Stack

| Peça | Escolha | Papel |
|---|---|---|
| Runtime JSX | próprio, via `jsxImportSource` | TSX → árvore de nós; sem React |
| Layout | yoga-layout (WASM) | flexbox; x, y, w, h |
| Fontes | fontkit | métricas, kerning, ascender/descender |
| Imagens | image-size | aspect ratio |
| Saída | pptxgenjs | gera o .pptx |
| Preview | @resvg/resvg-js | SVG → PNG com as fontes registradas |
| CLI | node:util parseArgs | sem framework |
| Testes | vitest | unitários e snapshot da árvore |
| Execução TSX | tsx | carrega o deck na CLI |

Convenções: ver `CLAUDE.md`.

## API para o dev

O dev nunca escreve coordenadas. Componentes e layouts base são funções puras `(props) => Node`.

| Primitiva | Props principais | Vira no PPTX |
|---|---|---|
| Deck | children (slides) | a apresentação |
| Slide | background (cor ou imagem), notes | um slide |
| Box | direction, gap, padding, align, justify, grow, shrink, width, height, fill, stroke, radius, position="absolute" + top/left/right/bottom | nada, ou shape se tiver fill/stroke |
| Text | font, size, weight, italic, color, lineHeight, align, fit, minSize, maxLines | caixa de texto nativa |
| Image | src, fit (contain/cover) | imagem |
| Shape | kind (rect, roundRect, ellipse, line), fill, stroke, strokeWidth | shape nativo |

Tamanhos: número em pt ou string `"50%"`. `position="absolute"` sai do fluxo flex (decoração de fundo).

```tsx
export default defineDeck((ctx) => (
  <Deck>
    <CoverLayout title="Resultados Q3" subtitle="Plataforma interna" />
    <TwoColumn
      stacked={ctx.aspect < 1.5}
      left={<Bullets items={['Item um', 'Item dois', 'Item três']} />}
      right={<Image src="./assets/chart.png" fit="contain" grow={1} />}
    />
  </Deck>
));
```

`ctx`: `width`, `height` (pt), `aspect`, `name`, `scale`.

```tsx
export const Bullets = ({ items, size = 20 }: BulletsProps) => (
  <Box direction="column" gap={12}>
    {items.map((item) => (
      <Box direction="row" gap={10} align="start">
        <Shape kind="ellipse" width={8} height={8} fill={tokens.accent} />
        <Text size={size} fit="shrink" minSize={14} grow={1}>{item}</Text>
      </Box>
    ))}
  </Box>
);

export const CoverLayout = ({ title, subtitle }: CoverProps) => (
  <Slide background={tokens.brand}>
    <Shape kind="ellipse" position="absolute" right={-80} top={-80}
      width="45%" height="80%" fill={tokens.brandDark} />
    <Box direction="column" justify="center" padding={48} gap={16} grow={1}>
      <Text size={48} weight="bold" color="#FFFFFF" fit="shrink" minSize={32}>{title}</Text>
      <Text size={22} color="#FFFFFF" fit="truncate" maxLines={2}>{subtitle}</Text>
    </Box>
  </Slide>
);
```

Tokens de design são um objeto TS importado pelos componentes.

## Arquitetura

Pipeline de funções puras por tamanho: árvore entra, árvore sai; só a última etapa toca o pptxgenjs. O loop Layout ↔ Ajuste roda até caber ou 12 iterações; o resto vira diagnóstico.

## Medição de texto

- `registerFont({ family, weight, italic, file })` explícito.
- Truque do MVP: medir com Liberation Sans (métricas compatíveis com Arial) e emitir o nome **Arial**.
- Fonte não registrada = diagnóstico, nunca fallback silencioso.

Algoritmo: (1) parágrafos por `\n`; (2) palavras medidas com fontkit (layout com kerning), `advance * size / unitsPerEm`; (3) quebra gulosa; (4) palavra maior que a linha quebra por caractere; (5) altura = linhas × altura de linha, com altura de linha = `(ascent - descent + lineGap) / unitsPerEm * size * lineHeight`. O texto vira nó Yoga com função de medida.

Emissão neutra: `margin: 0`, `valign: 'top'`, `fit: 'none'`, `wrap: true`, `paraSpaceBefore/After: 0`, `lineSpacingMultiple` explícito e calibrado.

Margem de segurança: a quebra usa largura × `TEXT_SAFETY` (0,97); a caixa sai com a largura cheia.

Calibração: `calibration.tsx` em modo debug; comparar texto com contorno.

## Overflow e diagnósticos

| fit | Comportamento | Severidade |
|---|---|---|
| shrink (padrão) | reduz 1 pt por passo até caber, sem passar de minSize (padrão 75% de size) | info se coube; error se nem no mínimo |
| truncate | corta nas linhas disponíveis (ou maxLines) com reticências | warning |
| error | mantém | error |

Loop: (1) layout natural; (2) detectar overflow (filho maior que área de conteúdo do pai, ou nó fora do slide); (3) em cada contêiner que estourou, um passo de shrink em todos os textos `fit="shrink"` juntos; (4) refazer até caber ou 12 iterações; (5) aplicar truncate e registrar o resto como error.

Formato: tipo `Diagnostic` em `src/core/types.ts`. `path` usa nomes das funções componentes ('CoverLayout > Box > Text[0]'). `message` escrita para LLM: "Texto estourou 18% da altura disponível mesmo em 14 pt; reduza o conteúdo ou aumente a área".

## Tamanhos

| Preset | pol | pt |
|---|---|---|
| 16x9 (padrão) | 10 × 5,625 | 720 × 405 |
| 16x10 | 10 × 6,25 | 720 × 450 |
| 4x3 | 10 × 7,5 | 720 × 540 |
| wide | 13,333 × 7,5 | 960 × 540 |
| custom | { width, height } pol | × 72 |

Camadas: flexbox/% → decisões via ctx → overflow. `ctx.scale` = menor razão entre tamanho atual e 720×405.

## API programática e CLI

```ts
const result = await render(deck, {
  sizes: ['16x9', '4x3'],
  fonts: [{ family: 'Arial', weight: 'regular', file: './fonts/LiberationSans-Regular.ttf' }],
  preview: { mode: 'native', width: 1280 }, // ou false
  debug: false,
});
```

`render` nunca grava arquivo nem imprime.

```
pptsx build examples/demo.tsx --size 16x9,4x3 --out dist/ [--debug] [--json] [--preview native|none] [--preview-width 1280]
```

Resumo legível dos diagnósticos (ou só JSON com `--json`); código de saída 1 se houver `error`. Fontes vêm de `pptsx.config.ts` opcional.

## Preview

Nativo: árvore posicionada → SVG → PNG (resvg), mesmas fontes e linhas já quebradas. Um `<text>` por linha. Imagens em base64 com preserveAspectRatio. `--debug` mostra contornos e overflow em vermelho. Overview: grade 4 colunas, miniaturas de 320 px, número abaixo, selo vermelho (error) e amarelo (warning), montado como SVG com PNGs embutidos e rasterizado pelo resvg.

```
dist/
├── demo.16x9.pptx
├── demo.16x9.overview.png
├── demo.16x9/slide-01.png
└── demo.diagnostics.json
```

## Marcos

1. **Runtime JSX e emissão crua** — runtime, primitivas, resolve com path, emissão só com `position="absolute"`. Pronto: hello world abre no PowerPoint/Keynote.
2. **Layout com Yoga e preview nativo** — props → Yoga; texto estimado (chars × 0,5 × size); preview e overview com --debug. Pronto: testes da árvore posicionada passam e overview coerente.
3. **Medição de texto (go/no-go)** — fontkit, quebra, função de medida, emissão neutra, calibration.tsx. Pronto: nenhum texto quebra numa linha diferente da calculada (Keynote; PowerPoint pelo dono).
4. **Overflow e diagnósticos** — loop, shrink/truncate/error, mensagens, selos. Pronto: slide lotado gera fonte reduzida ou diagnóstico, nunca texto cortado.
5. **Responsividade, CLI e demo** — presets, custom, ctx, CLI completa, demo.tsx (capa, título+bullets, duas colunas com imagem, KPI cards, encerramento). Pronto: 16:9 e 4:3 sem mudar código e sem error.

Parar ao fim de cada marco e mostrar o resultado.

## Critérios de sucesso

- [ ] demo.tsx gera 16:9 e 4:3 sem alteração no código do deck
- [ ] Cada build gera PNG por slide e overview por tamanho; dá para revisar só pelo overview
- [ ] Preview nativo bate visualmente com o renderizador real (Keynote / PowerPoint)
- [ ] Nenhum texto cortado, vazando ou com quebra diferente da calculada
- [ ] Todo texto e shape é editável nativamente (nada vira imagem)
- [ ] Slide lotado → fonte reduzida (info) ou error com path correto, e selo no overview
- [ ] Abre aceitavelmente no Google Slides e Keynote (diferenças anotadas)
- [ ] Testes cobrem quebra de linha, conversão de unidades, mapeamento Yoga, loop de ajuste e SVG de preview
- [ ] Um agente, só com a lista de primitivas e componentes, escreve um slide novo sem error, ou corrige um error lendo diagnostics.json e o overview

## Riscos e decisões

| Item | Tipo | Tratamento |
|---|---|---|
| Medição diverge do renderizador | Risco | marco 3 go/no-go; calibração e TEXT_SAFETY |
| Google Slides/Keynote com espaçamento diferente | Risco | medir e anotar |
| Fonte da marca precisa estar instalada | Risco | MVP usa Arial |
| Tipografia absoluta vs proporcional | Decisão | absoluto + ctx.scale opcional |
| Animações | Decisão | fora |
| Slide de continuação | Decisão | fora; vira diagnóstico |
| Layouts como masters | Decisão | fora |
| Nome do pacote | Decisão | provisório |

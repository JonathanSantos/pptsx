import type {
  Align,
  ChartProps,
  ContainerProps,
  FitPolicy,
  FlexDirection,
  FontWeight,
  ImageFit,
  ImageProps,
  Justify,
  LineBreaks,
  Pt,
  ArrowType,
  ShapeKind,
  ShapeProps,
  Spacing,
  TableFitPolicy,
  TableHeaderStyle,
  TableProps,
  TextAlign,
  TextProps,
  TextStyle,
} from './types.ts';

/**
 * Padrões únicos da engine. Os módulos nunca repetem esses valores:
 * importam daqui ou usam os helpers abaixo.
 */
export const DEFAULTS = {
  text: {
    font: 'Arial',
    size: 18,
    weight: 'regular',
    italic: false,
    color: '#000000',
    /** M11 (CSS): 'normal' = altura natural da face; número = múltiplo do size. */
    lineHeight: 'normal' as number | 'normal',
    align: 'left' as TextAlign,
    fit: 'shrink' as FitPolicy,
    /** minSize = max(floor(size * minSizeRatio), minLegibleSize) quando não informado */
    minSizeRatio: 0.75,
    /**
     * Piso de legibilidade (pt). O shrink sem minSize explícito não desce abaixo;
     * com minSize explícito menor, desce e avisa com text-illegible.
     */
    minLegibleSize: 10,
    /**
     * M13: corpo do sobrescrito/subscrito em relação ao do texto. O renderizador reduz sozinho quando
     * o run tem `baseline` (o emissor não grava `sz` menor); 2/3 medido no Keynote (relatório M13-3).
     */
    superscriptRatio: 2 / 3,
    /** M13: deslocamento da baseline em % do corpo (OOXML `baseline` = valor × 1000). */
    superscriptBaseline: 30,
    subscriptBaseline: -25,
    /** M13: Text paginate nunca deixa menos que isto de um parágrafo num lado do corte. */
    orphanLines: 2,
    /** M13: pesos canônicos e a distância (em unidades de peso) a partir da qual a face escolhida avisa. */
    weights: { regular: 400, bold: 700 },
    weightTolerance: 100,
    /** M13: conteúdo usado para medir um SlideNumber antes de saber o número (pior caso). */
    slideNumberSample: { n: '88', total: '88 / 88' },
  },
  container: {
    direction: 'column' as FlexDirection,
    gap: 0,
    padding: 0,
    align: 'stretch' as Align,
    justify: 'start' as Justify,
  },
  /**
   * Item flex: shrink 1 como no CSS (texto numa row quebra em vez de vazar) e
   * grow > 0 implica basis 0 (grow={1} = flex: 1, colunas iguais).
   */
  item: { shrink: 1, growBasis: 0 },
  strokeWidth: 1,
  /** Shape 'line' sem stroke seria invisível; recebe esta cor. */
  lineStroke: '#000000',
  imageFit: 'contain' as ImageFit,
  lang: 'pt-BR',
  /** Quebra forçada por padrão: o renderizador desenha exatamente as linhas calculadas. */
  lineBreaks: 'forced' as LineBreaks,
  /** M8: fontes embutidas desligadas por padrão (tamanho do arquivo e licença da fonte). */
  embedFonts: false,
  /**
   * M15: tema do arquivo. Cores ausentes do autor = as do tema Office (as que o pptxgenjs grava);
   * `schemes` é o nome de cada cor no XML (`<a:schemeClr val>`, nos slides: tx1/bg1 em vez de dk1/lt1)
   * e a ordem é a de desempate quando duas cores do tema têm o mesmo hex (acentos primeiro).
   */
  theme: {
    name: 'pptsx',
    colors: {
      dark1: '#000000', light1: '#FFFFFF', dark2: '#44546A', light2: '#E7E6E6',
      accent1: '#4472C4', accent2: '#ED7D31', accent3: '#A5A5A5', accent4: '#FFC000', accent5: '#5B9BD5', accent6: '#70AD47',
      hyperlink: '#0563C1', followedHyperlink: '#954F72',
    },
    schemes: [
      ['accent1', 'accent1'], ['accent2', 'accent2'], ['accent3', 'accent3'], ['accent4', 'accent4'], ['accent5', 'accent5'], ['accent6', 'accent6'],
      ['dark1', 'tx1'], ['light1', 'bg1'], ['dark2', 'tx2'], ['light2', 'bg2'], ['hyperlink', 'hlink'], ['followedHyperlink', 'folHlink'],
    ] as readonly (readonly [string, string])[],
  },
  /** M15: seção que recebe os slides antes da 1ª seção do autor (o PowerPoint exige todo slide numa seção). */
  defaultSection: 'Seção padrão',
  /**
   * M15: placeholder do autor → tipo do PowerPoint (`<p:ph type>`); outros nomes → 'body'.
   * `firstIndex`: idx dos placeholders que não são título (o título não leva idx).
   */
  placeholder: {
    types: { title: 'title', subtitle: 'subTitle', body: 'body', footer: 'ftr', pictures: 'pic' } as Readonly<Record<string, string>>,
    fallbackType: 'body',
    firstIndex: 10,
  },
  /** Largura de quebra = disponível * textSafety; a caixa sai com a largura cheia. */
  textSafety: 0.97,
  /** Limite de RODADAS do loop de ajuste (uma rodada = uma busca binária por escopo disparado). */
  maxFitIterations: 12,
  /** epsilon: tolerância (pt) na detecção de overflow. shrinkStep: granularidade (pt) do size na busca. */
  fit: { epsilon: 0.5, shrinkStep: 1 },
  /** M8: debounce do --watch (ms). */
  watchDebounceMs: 150,
  /** M9: 'tall' ⇔ aspect < tallAspect; 'wide' ⇔ scale > wideScale (ver core/responsive.ts). */
  breakpoints: { tallAspect: 1.5, wideScale: 1.2 },
  /** M9: máximo de partes em que um slide com Box paginate pode se dividir; passou → box-overflow. */
  paginate: { maxParts: 10 },
  /** M10: gráfico nativo. Paleta cíclica por série/categoria; tipografia de rótulos, eixos, legenda e título. */
  chart: {
    palette: ['#2F6FED', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#64748B'] as readonly string[],
    labelSize: 12,
    labelColor: '#333333',
    /** Espaço entre grupos de barras em % da largura da barra (OOXML gapWidth). */
    barGapWidthPct: 80,
    /** Espessura da linha (pt) no gráfico de linhas. */
    lineSize: 2,
    /** Largura da borda (pt) ao redor do gráfico; 0 = sem borda. */
    borderWidth: 0,
    /** M14: furo do doughnut em % do diâmetro. */
    holeSize: 50,
    /** M14: tamanho (pt) do marcador de ponto (scatter, line/combo com markers). */
    markerSize: 6,
    /** M14: área preenchida com esta opacidade (0..1) no preview e no PPTX. */
    areaOpacity: 0.85,
  },
  /** M10: tabela nativa. Células com o mesmo size; margem interna por lado; cabeçalho em negrito sem fundo. */
  table: {
    size: 14,
    cellPadding: 4,
    header: { weight: 'bold' as FontWeight } as TableHeaderStyle,
    fit: 'shrink' as TableFitPolicy,
    /** Espessura das bordas (pt) quando `border` é informado. */
    borderWidth: 0.5,
    /**
     * M11: passo (pt) a que a altura de cada linha é arredondada PARA CIMA já no layout, porque o
     * Keynote/PowerPoint só crescem a linha quando falta espaço; assim frame, fit, emissão e preview
     * usam a mesma altura (achado M10-H: drift de até 0,4 pt por linha).
     */
    rowHeightStep: 0.5,
    /** M14: espaço (pt) entre o ícone de uma célula e o texto. */
    iconGap: 4,
  },
  /** 16:9 de referência para ctx.scale */
  referenceSize: { width: 720, height: 405 },
  /** M11: padrões do modelo CSS (vindos da PoC). */
  css: {
    /** Box sem `display` continua flex column (a única diferença intencional em relação ao browser); `display: 'flex'` explícito é row. */
    boxDisplay: 'flex',
    legacyDirection: 'column',
    cssFlexDirection: 'row',
    flexShrink: 1,
    flexGrow: 0,
    order: 0,
    opacity: 1,
    /** Espessura de `border: solid #000` sem largura (CSS: medium). */
    borderMediumWidth: 3,
    degreesPerTurn: 360,
    radiansToDegrees: 180 / Math.PI,
    /** `font-weight` numérico a partir do qual a face é bold (a engine tem só regular/bold). */
    boldWeightFrom: 600,
    regularWeight: 400,
    boldWeight: 700,
    percentBase: 100,
    colorChannelMax: 255,
    /** Ruído de ponto flutuante do Yoga ao comparar frames. */
    layoutNoise: 1e-6,
    /** Tolerância (pt) das comparações com fixtures do browser. */
    frameTolerance: 1,
    /** PPTX: transparência é 0..100. */
    transparencyScale: 100,
  },
  preview: { width: 1280, thumbWidth: 320, overviewColumns: 4 },
  /**
   * M12: formas. `pptx[kind]` = `prstGeom` emitido e os ajustes (`adj`, em 1/100000 como no
   * OOXML) que o PPTX usa por padrão; o preview (src/preview/shapes.ts) desenha com esses mesmos
   * números para bater com o Keynote/PowerPoint. A engine não muda os ajustes (só `roundRect`/`pill`,
   * pelo raio).
   */
  shape: {
    pptx: {
      rect: { prst: 'rect', adj: {} },
      roundRect: { prst: 'roundRect', adj: { adj: 16667 } },
      ellipse: { prst: 'ellipse', adj: {} },
      line: { prst: 'line', adj: {} },
      triangle: { prst: 'triangle', adj: { adj: 50000 } },
      rightTriangle: { prst: 'rtTriangle', adj: {} },
      diamond: { prst: 'diamond', adj: {} },
      parallelogram: { prst: 'parallelogram', adj: { adj: 25000 } },
      trapezoid: { prst: 'trapezoid', adj: { adj: 25000 } },
      pentagon: { prst: 'pentagon', adj: { hf: 105146, vf: 110557 } },
      hexagon: { prst: 'hexagon', adj: { adj: 25000, vf: 115470 } },
      octagon: { prst: 'octagon', adj: { adj: 29289 } },
      chevron: { prst: 'chevron', adj: { adj: 50000 } },
      arrowRight: { prst: 'rightArrow', adj: { adj1: 50000, adj2: 50000 } },
      arrowLeft: { prst: 'leftArrow', adj: { adj1: 50000, adj2: 50000 } },
      arrowUp: { prst: 'upArrow', adj: { adj1: 50000, adj2: 50000 } },
      arrowDown: { prst: 'downArrow', adj: { adj1: 50000, adj2: 50000 } },
      doubleArrow: { prst: 'leftRightArrow', adj: { adj1: 50000, adj2: 50000 } },
      pill: { prst: 'roundRect', adj: { adj: 50000 } },
      star: { prst: 'star5', adj: { adj: 19098, hf: 105146, vf: 110557 } },
      cloud: { prst: 'cloud', adj: {} },
      callout: { prst: 'wedgeRectCallout', adj: { adj1: -20833, adj2: 62500 } },
      bracketPair: { prst: 'bracketPair', adj: { adj: 16667 } },
      cylinder: { prst: 'can', adj: { adj: 25000 } },
    } as Readonly<Record<ShapeKind, { readonly prst: string; readonly adj: Readonly<Record<string, number>> }>>,
    /** Escala dos `adj` do OOXML (100000 = 100 %). */
    adjScale: 100000,
    /**
     * Ponta de seta OOXML `w="med" len="med"`: largura e comprimento = 3 × a espessura da linha,
     * com um mínimo para linhas finas não sumirem com a seta (o PowerPoint/Keynote fazem igual).
     */
    arrow: { widthFactor: 3, lengthFactor: 3, minSize: 4.5 },
  },
  /** M12: Path sem fill nem stroke recebe este fill (como o SVG, que pinta de preto). */
  path: { fill: '#000000' },
  /** M12: ícone SVG. `rasterScale`: a imagem sai com 2× a largura final em px, para ficar nítida. */
  icon: { size: 24, rasterScale: 2, pxPerPt: 96 / 72 },
  /** M12: conector entre nós. */
  connector: {
    stroke: '#333333',
    strokeWidth: 1.5,
    endArrow: 'triangle' as ArrowType,
    startArrow: 'none' as ArrowType,
    /** Cotovelo com o mesmo lado nas duas pontas: a dobra sai para fora dos nós esta distância (pt). */
    elbowOffset: 16,
    /** Rótulo: tipografia, respiro (pt) entre o texto e o fundo. */
    label: { size: 12, color: '#333333', padding: 3 },
  },
} as const;

export const PT_PER_INCH = 72;
/** Imagens: 1 px CSS = 1/96 pol; é o tamanho "natural" e o limite de upscale. */
export const PT_PER_PX = PT_PER_INCH / 96;

export const textStyleOf = (props: TextProps): TextStyle => ({
  family: props.font ?? DEFAULTS.text.font,
  size: props.size ?? DEFAULTS.text.size,
  weight: props.weight ?? DEFAULTS.text.weight,
  italic: props.italic ?? DEFAULTS.text.italic,
  lineHeight: props.lineHeight ?? DEFAULTS.text.lineHeight,
});

/** M13: peso numérico de um FontWeight ('regular' = 400, 'bold' = 700). */
export const weightValueOf = (weight: FontWeight): number => {
  if (weight === 'regular') return DEFAULTS.text.weights.regular;
  if (weight === 'bold') return DEFAULTS.text.weights.bold;
  return weight;
};

/** M13: forma canônica: 400 → 'regular', 700 → 'bold', o resto numérico. */
export const canonicalWeightOf = (weight: FontWeight): FontWeight => {
  const value = weightValueOf(weight);
  if (value === DEFAULTS.text.weights.regular) return 'regular';
  if (value === DEFAULTS.text.weights.bold) return 'bold';
  return value;
};

export const fitPolicyOf = (props: TextProps): FitPolicy => props.fit ?? DEFAULTS.text.fit;

/** Sem minSize do autor, o piso é o maior entre a proporção e o mínimo legível; com minSize, vale o do autor. */
export const minSizeOf = (props: TextProps): Pt =>
  props.minSize ??
  Math.max(Math.floor((props.size ?? DEFAULTS.text.size) * DEFAULTS.text.minSizeRatio), DEFAULTS.text.minLegibleSize);

export const imageFitOf = (props: ImageProps): ImageFit => props.fit ?? DEFAULTS.imageFit;

export interface Edges {
  readonly top: Pt;
  readonly right: Pt;
  readonly bottom: Pt;
  readonly left: Pt;
}

export const edgesOf = (spacing: Spacing | undefined): Edges => {
  if (spacing === undefined) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof spacing === 'number') return { top: spacing, right: spacing, bottom: spacing, left: spacing };
  return { top: spacing.top ?? 0, right: spacing.right ?? 0, bottom: spacing.bottom ?? 0, left: spacing.left ?? 0 };
};

export const containerOf = (props: ContainerProps) => ({
  direction: props.direction ?? DEFAULTS.container.direction,
  gap: props.gap ?? DEFAULTS.container.gap,
  padding: edgesOf(props.padding),
  align: props.align ?? DEFAULTS.container.align,
  justify: props.justify ?? DEFAULTS.container.justify,
});

/** Formas que são só traço: sem stroke seriam invisíveis. */
const STROKE_ONLY: ReadonlySet<ShapeKind> = new Set<ShapeKind>(['line', 'bracketPair']);

/** Cor de contorno efetiva: linha e colchetes sempre têm cor, os demais só se o autor pediu. */
export const strokeColorOf = (props: ShapeProps): string | undefined =>
  props.stroke ?? (STROKE_ONLY.has(props.kind) ? DEFAULTS.lineStroke : undefined);

/** M12: pintura efetiva de um Path: o do autor; sem fill nem stroke, fill preto (como o SVG). */
export const pathPaintOf = (props: { readonly fill?: string; readonly stroke?: string }): { readonly fill?: string; readonly stroke?: string } =>
  props.fill === undefined && props.stroke === undefined ? { fill: DEFAULTS.path.fill } : { fill: props.fill, stroke: props.stroke };

/** M12: tamanho de uma ponta de seta (pt) para uma linha de espessura `width`. */
export const arrowSizeOf = (width: Pt): { readonly width: Pt; readonly length: Pt } => {
  const { widthFactor, lengthFactor, minSize } = DEFAULTS.shape.arrow;
  return { width: Math.max(width * widthFactor, minSize), length: Math.max(width * lengthFactor, minSize) };
};

/** M10: estilo de texto efetivo das células da tabela (todas iguais). */
export const tableStyleOf = (props: TableProps): TextStyle => ({
  family: props.font ?? DEFAULTS.text.font,
  size: props.size ?? DEFAULTS.table.size,
  weight: DEFAULTS.text.weight,
  italic: DEFAULTS.text.italic,
  lineHeight: props.lineHeight ?? DEFAULTS.text.lineHeight,
});

export const tableFitOf = (props: TableProps): TableFitPolicy => props.fit ?? DEFAULTS.table.fit;

/** Mesma regra do Text: 75% do size com piso legível, salvo minSize do autor. */
export const tableMinSizeOf = (props: TableProps): Pt =>
  props.minSize ??
  Math.max(Math.floor((props.size ?? DEFAULTS.table.size) * DEFAULTS.text.minSizeRatio), DEFAULTS.text.minLegibleSize);

/** Cabeçalho efetivo; `false` = sem linha de cabeçalho (undefined aqui). */
export const tableHeaderOf = (props: TableProps): TableHeaderStyle | undefined =>
  props.header === false ? undefined : { ...DEFAULTS.table.header, ...props.header };

/** M10: tipografia dos rótulos do gráfico. */
export const chartLabelStyleOf = (props: ChartProps): { family: string; size: Pt; color: string } => ({
  family: props.font ?? DEFAULTS.text.font,
  size: props.size ?? DEFAULTS.chart.labelSize,
  color: props.color ?? DEFAULTS.chart.labelColor,
});

/** Cor da i-ésima série/categoria: as do autor e, faltando, a paleta cíclica. */
export const chartColorOf = (props: ChartProps, index: number): string => {
  const own = props.colors?.[index];
  if (own !== undefined) return own;
  const palette = DEFAULTS.chart.palette;
  return palette[index % palette.length] ?? DEFAULTS.chart.labelColor;
};

/** Legenda: explícita, senão só com mais de uma série (pie sempre). */
export const chartLegendOf = (props: ChartProps): boolean => {
  if (props.legend !== undefined) return props.legend !== false;
  return props.kind === 'pie' || props.kind === 'doughnut' || props.data.series.length > 1;
};

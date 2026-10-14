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
  },
  /** M10: tabela nativa. Células com o mesmo size; margem interna por lado; cabeçalho em negrito sem fundo. */
  table: {
    size: 14,
    cellPadding: 4,
    header: { weight: 'bold' as FontWeight } as TableHeaderStyle,
    fit: 'shrink' as TableFitPolicy,
    /** Espessura das bordas (pt) quando `border` é informado. */
    borderWidth: 0.5,
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

/** Cor de contorno efetiva: a linha sempre tem cor, os demais só se o autor pediu. */
export const strokeColorOf = (props: ShapeProps): string | undefined =>
  props.stroke ?? (props.kind === 'line' ? DEFAULTS.lineStroke : undefined);

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
export const chartLegendOf = (props: ChartProps): boolean =>
  props.legend ?? (props.kind === 'pie' || props.data.series.length > 1);

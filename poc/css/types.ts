/**
 * Tipos da PoC CSS. Reexporta os contratos de src/core/types.ts e substitui os nós
 * resolvidos/posicionados por versões que carregam `css` (o estilo CSS já normalizado
 * e herdado). Os nós da PoC são superconjuntos dos da engine: os helpers de src/
 * (textStyleOf, containerOf, emissores, SVG) continuam aceitando-os.
 */
import type * as Core from '../../src/core/types.ts';

export type * from '../../src/core/types.ts';

// ───────────────────────── Valores CSS ─────────────────────────

/** Comprimento normalizado: número = pt; string = percentual do pai. */
export type Len = number | `${number}%`;
export type MarginLen = Len | 'auto';

export interface Sides<T> {
  readonly top: T;
  readonly right: T;
  readonly bottom: T;
  readonly left: T;
}

export type Side = keyof Sides<unknown>;

export type BorderStyle = 'solid' | 'dashed' | 'dotted' | 'none';

export interface BorderSide {
  readonly width: Core.Pt;
  readonly style: BorderStyle;
  /** Hex '#RRGGBB'; undefined = currentColor (resolvido para a cor de texto herdada). */
  readonly color: Core.Color;
  /** 0..1, de rgba(); 1 = opaca. */
  readonly alpha: number;
}

export interface Shadow {
  readonly x: Core.Pt;
  readonly y: Core.Pt;
  readonly blur: Core.Pt;
  readonly spread: Core.Pt;
  readonly color: Core.Color;
  readonly alpha: number;
  readonly inset: boolean;
}

export type Display = 'flex' | 'block' | 'grid' | 'none';
export type CssPosition = 'static' | 'relative' | 'absolute';
export type CssFlexDirection = 'row' | 'column' | 'row-reverse' | 'column-reverse';
export type CssFlexWrap = 'nowrap' | 'wrap' | 'wrap-reverse';
export type CssJustify = 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
export type CssAlign = 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
export type CssAlignContent = CssJustify | 'stretch';
/** Alinhamento de item de grid na célula (eixo de linha ou de coluna). */
export type CssPlace = 'start' | 'center' | 'end' | 'stretch';

/**
 * De onde vem o flex-basis: 'author' (flexBasis/flex 'a b c'), 'flex' (`flex: n` → 0, salvo
 * Text/Table em column, que emula o min-height:auto do browser) ou 'grow' (açúcar antigo
 * `grow={n}`: a regra da engine, basis 0 só sem tamanho no eixo principal).
 */
export type BasisSource = 'none' | 'author' | 'flex' | 'grow';

export interface TextDecoration {
  readonly underline: boolean;
  readonly lineThrough: boolean;
}

export type TextTransform = 'none' | 'uppercase' | 'lowercase' | 'capitalize';

/** Propriedade que chegou ao nó e não tem de/para para o PPTX (vira css-not-emitted). */
export interface NotEmitted {
  readonly property: string;
  readonly value: string;
  /** Frase curta para a mensagem: o que acontece com ela. */
  readonly reason: string;
}

/** Linha de grid: número (1-based, negativo conta do fim), span n ou auto. */
export type GridLine = { readonly kind: 'line'; readonly index: number } | { readonly kind: 'span'; readonly count: number } | { readonly kind: 'auto' };

export interface GridPlacement {
  readonly start: GridLine;
  readonly end: GridLine;
}

/** Estilo CSS normalizado de um nó (sem shorthands, sem responsivo, já com herança). */
export interface CssStyle {
  readonly display: Display;
  readonly position: CssPosition;
  readonly inset: Partial<Sides<Len>>;
  readonly width?: Len;
  readonly height?: Len;
  readonly minWidth?: Len;
  readonly maxWidth?: Len;
  readonly minHeight?: Len;
  readonly maxHeight?: Len;
  readonly aspectRatio?: number;
  readonly flexDirection: CssFlexDirection;
  readonly flexWrap: CssFlexWrap;
  readonly justifyContent: CssJustify;
  readonly alignItems: CssAlign;
  readonly alignContent: CssAlignContent;
  readonly alignSelf?: CssAlign;
  readonly justifySelf?: CssPlace;
  readonly justifyItems?: CssPlace;
  readonly flexGrow: number;
  readonly flexShrink: number;
  readonly flexBasis: Len | 'auto';
  readonly basisSource: BasisSource;
  readonly order: number;
  readonly rowGap: Core.Pt;
  readonly columnGap: Core.Pt;
  readonly margin: Sides<MarginLen>;
  readonly padding: Sides<Len>;
  readonly border: Sides<BorderSide>;
  readonly borderRadius?: Core.Pt;
  readonly backgroundColor?: Core.Color;
  readonly backgroundAlpha: number;
  readonly backgroundImage?: string;
  /** Açúcar antigo `stroke`: contorno que não ocupa espaço (como `outline`), centrado na borda. */
  readonly outline?: { readonly color: Core.Color; readonly width: Core.Pt };
  readonly boxShadow?: Shadow;
  readonly opacity: number;
  /** Graus, sentido horário (como CSS e PPTX). */
  readonly rotate: number;
  readonly translate: { readonly x: Core.Pt; readonly y: Core.Pt };
  readonly zIndex?: number;
  readonly overflow: 'visible' | 'hidden';
  readonly gridTemplateColumns?: string;
  readonly gridTemplateRows?: string;
  readonly gridAutoRows?: string;
  readonly gridAutoColumns?: string;
  readonly gridColumn: GridPlacement;
  readonly gridRow: GridPlacement;
  readonly textDecoration: TextDecoration;
  readonly letterSpacing: Core.Pt;
  readonly textTransform: TextTransform;
  readonly notEmitted: readonly NotEmitted[];
}

// ───────────────────────── Árvore resolvida da PoC ─────────────────────────

interface WithCss {
  readonly css: CssStyle;
}

/** Run com decoração de texto (Span ganha textDecoration). */
export interface TextRun extends Core.TextRun {
  readonly underline?: boolean;
  readonly lineThrough?: boolean;
}

export type ResolvedBox = Omit<Core.ResolvedBox, 'children'> & WithCss & { readonly children: readonly ResolvedNode[] };
export type ResolvedText = Omit<Core.ResolvedText, 'runs'> & WithCss & { readonly runs: readonly TextRun[] };
export type ResolvedImage = Core.ResolvedImage & WithCss;
export type ResolvedShape = Core.ResolvedShape & WithCss;
export type ResolvedChart = Core.ResolvedChart & WithCss;
export type ResolvedTable = Core.ResolvedTable & WithCss;
export type ResolvedNode = ResolvedBox | ResolvedText | ResolvedImage | ResolvedShape | ResolvedChart | ResolvedTable;

export type ResolvedSlide = Omit<Core.ResolvedSlide, 'children'> & WithCss & { readonly children: readonly ResolvedNode[] };

export interface ResolvedDeck {
  readonly slides: readonly ResolvedSlide[];
}

// ───────────────────────── Árvore posicionada da PoC ─────────────────────────

/** Caixa resolvida pelo layout (pt; % e auto já calculados). */
export interface BoxMetrics {
  readonly margin: Sides<Core.Pt>;
  readonly border: Sides<Core.Pt>;
  readonly padding: Sides<Core.Pt>;
}

interface Positioned {
  /** Border-box ABSOLUTO no slide, em pt, antes de girar (como o browser: o layout ignora a rotação). */
  readonly frame: Core.Rect;
  readonly box: BoxMetrics;
  /** Item de grid: a área (célula) que o grid deu a ele, absoluta. É a área disponível do item no fit. */
  readonly cell?: Core.Rect;
}

export type PositionedBox = Omit<ResolvedBox, 'children'> & Positioned & { readonly children: readonly PositionedNode[] };
export type PositionedText = ResolvedText & Positioned & { readonly text: Core.TextLayout };
export type PositionedImage = ResolvedImage & Positioned & { readonly intrinsic: Core.Dimensions };
export type PositionedShape = ResolvedShape & Positioned;
export type PositionedChart = ResolvedChart & Positioned;
export type PositionedTable = ResolvedTable &
  Positioned &
  Pick<Core.PositionedTable, 'fontSize' | 'columnWidths' | 'rowHeights' | 'cells' | 'height'>;
export type PositionedNode = PositionedBox | PositionedText | PositionedImage | PositionedShape | PositionedChart | PositionedTable;

export type PositionedSlide = Omit<ResolvedSlide, 'children'> & Positioned & { readonly children: readonly PositionedNode[] };

export interface PositionedDeck {
  readonly size: Core.SlideSize;
  readonly slides: readonly PositionedSlide[];
}

// ───────────────────────── Diagnósticos ─────────────────────────

/** Código novo da PoC: propriedade CSS sem de/para para o PPTX. */
export type DiagnosticCode = Core.DiagnosticCode | 'css-not-emitted';

export type Diagnostic = Omit<Core.Diagnostic, 'code'> & { readonly code: DiagnosticCode };

/** Medição com espaçamento entre letras (pt por caractere, como o CSS). */
export interface TextMeasureInput extends Core.TextMeasureInput {
  readonly letterSpacing?: Core.Pt;
}

export type TextMeasurer = (input: TextMeasureInput) => Core.TextLayout;

export interface LayoutEnv {
  readonly measureText: TextMeasurer;
  readonly imageSize: (src: string) => Core.Dimensions;
  /** Folga da quebra do medidor (o min-content do grid precisa dela); padrão DEFAULTS.textSafety. */
  readonly textSafety?: number;
}

export interface RenderResult extends Omit<Core.RenderResult, 'diagnostics' | 'positioned'> {
  readonly diagnostics: readonly Diagnostic[];
  readonly positioned?: PositionedDeck;
}

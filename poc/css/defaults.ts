/**
 * Padrões da PoC CSS. Os da engine continuam em src/core/defaults.ts (importados de lá);
 * aqui só o que é novo do modelo CSS.
 */
export const POC_DEFAULTS = {
  /** Box sem `display` continua flex column (como a engine hoje); `display: 'flex'` explícito é row, como no CSS. */
  boxDisplay: 'flex',
  legacyDirection: 'column',
  cssFlexDirection: 'row',
  /** CSS: initial values. */
  flexShrink: 1,
  flexGrow: 0,
  order: 0,
  opacity: 1,
  /** Espessura de `border: solid #000` sem largura (CSS: medium). */
  borderMediumWidth: 3,
  /** Grau por volta (rotate em turn). */
  degreesPerTurn: 360,
  radiansToDegrees: 180 / Math.PI,
  /** `font-weight` numérico a partir do qual a face é bold (a engine tem só regular/bold). */
  boldWeightFrom: 600,
  regularWeight: 400,
  boldWeight: 700,
  /** Percentual: base de `50%`. */
  percentBase: 100,
  /** Canal de cor (rgb 0..255). */
  colorChannelMax: 255,
  /** Ruído de ponto flutuante do Yoga ao comparar frames. */
  layoutNoise: 1e-6,
  /** Tolerância (pt) das comparações com fixtures do browser (H3/H4). */
  frameTolerance: 1,
  /** PPTX: transparência é 0..100. */
  transparencyScale: 100,
} as const;

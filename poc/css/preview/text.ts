import { DEFAULTS, textStyleOf } from '../../../src/core/defaults.ts';
import type { Color, FontWeight } from '../../../src/core/types.ts';
import { ANCHORS, type TextSvgOptions } from '../../../src/preview/svg.ts';
import { element, escapeXml, type Attrs } from '../../../src/preview/xml.ts';
import type { PositionedText, TextRun } from '../types.ts';

/**
 * Cópia de textSvg (src/preview/svg.ts) com o que a PoC emite por run: sublinhado e
 * riscado (Span/textDecoration) e letter-spacing. O preview desenha o que o .pptx tem.
 */

interface SvgRunStyle {
  readonly weight: FontWeight;
  readonly italic: boolean;
  readonly color: Color;
  readonly underline?: boolean;
  readonly lineThrough?: boolean;
}

const decorationOf = (style: SvgRunStyle): string | undefined => {
  const parts = [style.underline ? 'underline' : '', style.lineThrough ? 'line-through' : ''].filter(Boolean);
  return parts.length === 0 ? undefined : parts.join(' ');
};

const runStyleAttrs = (style: SvgRunStyle): Attrs => ({
  'font-weight': style.weight === 'bold' ? 'bold' : 'normal',
  'font-style': style.italic ? 'italic' : 'normal',
  fill: style.color,
  'text-decoration': decorationOf(style),
});

const tspanOf = (text: string, style: SvgRunStyle): string =>
  element('tspan', { ...runStyleAttrs(style), 'xml:space': 'preserve' }, escapeXml(text));

const lineTspansOf = (node: PositionedText, base: SvgRunStyle): readonly string[] => {
  const runs: readonly TextRun[] = node.runs;
  const { lineRuns, lines } = node.text;
  if (lineRuns.length !== lines.length) return lines.map((line) => tspanOf(line, base));
  return lineRuns.map((pieces) => pieces.map((piece) => tspanOf(piece.text, runs[piece.run] ?? base)).join(''));
};

export const cssTextSvg = (node: PositionedText, options: TextSvgOptions = {}): string => {
  const style = textStyleOf(node.props);
  const base: SvgRunStyle = {
    weight: style.weight,
    italic: style.italic,
    color: node.props.color ?? DEFAULTS.text.color,
    underline: node.css.textDecoration.underline,
    lineThrough: node.css.textDecoration.lineThrough,
  };
  const { anchor, offset } = ANCHORS[node.props.align ?? DEFAULTS.text.align];
  const { lineHeight, ascent, fontSize } = node.text;
  const common: Attrs = {
    x: node.frame.x + node.frame.width * offset,
    'text-anchor': anchor,
    'font-family': options.fontFamilyMap?.[style.family] ?? style.family,
    'font-size': fontSize,
    'letter-spacing': node.css.letterSpacing === 0 ? undefined : node.css.letterSpacing,
    ...runStyleAttrs({ ...base, underline: false, lineThrough: false }),
    'xml:space': 'preserve',
  };
  return lineTspansOf(node, base)
    .map((tspans, i) => element('text', { ...common, y: node.frame.y + i * lineHeight + ascent }, tspans))
    .join('');
};

import type { PositionedText, Rect } from '../core/types.ts';
import type * as Pptx from './pptx.ts';

/**
 * M13-6: o número do SlideNumber sai como campo nativo `slidenum` (o PowerPoint atualiza ao
 * reordenar). O pptxgenjs não tem campo em run: o emissor marca o run do número e o
 * pós-processamento (sanitize) troca o `<a:r>` marcado por `<a:fld type="slidenum">`.
 */

/** Marcador invisível no texto do run (palavras-separadoras U+2060 em volta). */
const MARK = '⁠pptsx-slidenum⁠';

/** GUID que o PowerPoint usa no campo de número de slide. */
const FIELD_ID = '{B6F15528-21DE-4FAA-801E-634DDDAF4B2B}';

export const withSlideNumberField = (runs: Pptx.TextProps[], node: PositionedText): Pptx.TextProps[] => {
  const index = node.slideNumber?.index;
  const [first, ...rest] = runs;
  if (index === undefined || first === undefined || typeof first.text !== 'string') return runs;
  const number = String(index);
  if (!first.text.startsWith(number)) return runs;
  const after = first.text.slice(number.length);
  const field: Pptx.TextProps = { ...first, text: `${MARK}${number}` };
  return after === '' ? [field, ...rest] : [field, { ...first, text: after }, ...rest];
};

// O corpo do <a:rPr> não pode conter </a:rPr>: senão o match começaria num run anterior e
// engoliria o texto até o run marcado.
const MARKED_RUN = new RegExp(`<a:r>(<a:rPr\\b[^>]*?(?:/>|>(?:(?!</a:rPr>)[\\s\\S])*</a:rPr>))<a:t>${MARK}(\\d+)</a:t></a:r>`, 'g');

/** Troca cada run marcado pelo campo; o resto do XML fica intacto. */
export const applySlideNumberFields = (xml: string): string =>
  xml.includes(MARK) ? xml.replace(MARKED_RUN, (_match, rPr: string, number: string) => `<a:fld id="${FIELD_ID}" type="slidenum">${rPr}<a:t>${number}</a:t></a:fld>`) : xml;

export interface TextBox {
  readonly runs: Pptx.TextProps[];
  readonly options: Pptx.TextPropsOptions;
  readonly frame: Rect;
}

/**
 * Caixas de texto de um Text. SlideNumber "n / total": o número (campo) numa caixa do tamanho dele e
 * o resto noutra, encostada; as duas alinhadas à esquerda a partir de onde o rótulo começaria pelo
 * `align` do Text. Qualquer outro Text: uma caixa só, como antes.
 */
export const slideNumberBoxesOf = (node: PositionedText, runs: Pptx.TextProps[], options: Pptx.TextPropsOptions): readonly TextBox[] => {
  const number = node.slideNumber;
  const withField = withSlideNumberField(runs, node);
  const [field, ...rest] = withField;
  if (number?.format !== 'n / total' || number.numberWidth === undefined || number.labelWidth === undefined || field === undefined || rest.length === 0) {
    return [{ runs: withField, options, frame: node.frame }];
  }
  const { frame } = node;
  const free = frame.width - number.labelWidth;
  const start = frame.x + (options.align === 'right' ? free : options.align === 'center' ? free / 2 : 0);
  const restX = start + number.numberWidth;
  return [
    { runs: [field], options: { ...options, align: 'left' }, frame: { ...frame, x: start, width: number.numberWidth } },
    { runs: rest, options: { ...options, align: 'left' }, frame: { ...frame, x: restX, width: Math.max(frame.x + frame.width - restX, number.labelWidth - number.numberWidth) } },
  ];
};

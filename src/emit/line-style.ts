import type { LineCap, LineJoin, LineStyle } from '../core/types.ts';
import type * as Pptx from './pptx.ts';

/**
 * Traço das formas (M12): `lineStyle` vira `prstDash`, que o pptxgenjs já escreve. `lineCap` e
 * `lineJoin` não existem nas opções do pptxgenjs: o emissor grava uma marca no nome do shape
 * (`objectName`) e o pós-processamento do XML (sanitize) põe `cap="rnd"` e `<a:round/>`/
 * `<a:bevel/>`/`<a:miter/>` no `<a:ln>` daquele shape, devolvendo um nome limpo.
 */

const DASHES: Readonly<Record<LineStyle, Pptx.ShapeLineProps['dashType']>> = {
  solid: 'solid',
  dashed: 'dash',
  dotted: 'sysDot',
};

/** `dashType` só quando não é sólido (o padrão do PPTX). */
export const dashOf = (style: LineStyle | undefined): { readonly dashType?: Pptx.ShapeLineProps['dashType'] } =>
  style === undefined || style === 'solid' ? {} : { dashType: DASHES[style] };

const MARKER = 'pptsx-ln';
const MARKER_NAME = new RegExp(`name="${MARKER} cap=(\\w+) join=(\\w+) (?:[^"]*)"`);
/** Nome que fica no arquivo (painel de seleção do PowerPoint). */
const CLEAN_NAME = 'Forma';

export interface LineEnds {
  readonly cap?: LineCap;
  readonly join?: LineJoin;
}

/** objectName com a marca; undefined quando cap e join são os padrões do PPTX (flat, miter). */
export const lineMarkerOf = ({ cap, join }: LineEnds, index: number): { readonly objectName?: string } => {
  const roundCap = cap === 'round';
  const customJoin = join !== undefined && join !== 'miter';
  if (!roundCap && !customJoin) return {};
  // O índice deixa o nome único: o pptxgenjs não exige, mas o painel de seleção agradece.
  return { objectName: `${MARKER} cap=${roundCap ? 'rnd' : 'flat'} join=${join ?? 'miter'} ${index}` };
};

const SHAPE = /<p:sp>[\s\S]*?<\/p:sp>/g;
const LINE_OPEN = /<a:ln\b([^>]*?)(\/?)>/;
const JOIN_ANCHOR = /<a:(?:headEnd|tailEnd)\b|<\/a:ln>/;

/** cap no atributo; a junção vai depois de fill/prstDash e antes das pontas (ordem do CT_LineProperties). */
const patchLine = (shape: string, cap: string, join: string): string => {
  const open = LINE_OPEN.exec(shape);
  if (open === null) return shape;
  const attrs = open[1]!.replace(/\scap="[^"]*"/, '');
  const capAttr = cap === 'rnd' ? ' cap="rnd"' : '';
  const joinTag = `<a:${join}/>`;
  if (open[2] === '/') return shape.replace(open[0], `<a:ln${attrs}${capAttr}>${joinTag}</a:ln>`);
  const start = open.index + open[0].length;
  const rest = shape.slice(start);
  const anchor = JOIN_ANCHOR.exec(rest);
  const at = anchor === null ? rest.length : anchor.index;
  return `${shape.slice(0, open.index)}<a:ln${attrs}${capAttr}>${rest.slice(0, at)}${joinTag}${rest.slice(at)}`;
};

const patchShape = (shape: string): string => {
  const marker = MARKER_NAME.exec(shape);
  if (marker === null) return shape;
  const [, cap, join] = marker;
  return patchLine(shape.replace(MARKER_NAME, `name="${CLEAN_NAME}"`), cap!, join!);
};

/** Aplica as marcas de cap/join de um slide inteiro; shapes sem marca ficam intactos. */
export const applyLineMarkers = (xml: string): string => (xml.includes(MARKER) ? xml.replace(SHAPE, patchShape) : xml);

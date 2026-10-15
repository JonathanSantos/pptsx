/** Parse estrutural mínimo de SVG por regex (sem dependência nova). */

export interface SvgElement {
  readonly tag: string;
  readonly attrs: Readonly<Record<string, string>>;
  /** Conteúdo bruto entre as tags (vazio para elementos auto-fechados). */
  readonly inner: string;
  /** Posição no documento (ordem de desenho). */
  readonly index: number;
  readonly raw: string;
}

const ATTR = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

export const parseAttrs = (source: string): Record<string, string> => {
  const attrs: Record<string, string> = {};
  for (const m of source.matchAll(ATTR)) attrs[m[1]!] = m[2] ?? m[3] ?? '';
  return attrs;
};

/** Todos os elementos <tag> do documento, na ordem em que aparecem. */
export const findElements = (svg: string, tag: string): SvgElement[] => {
  const re = new RegExp(`<${tag}(?=[\\s/>])((?:[^>"']|"[^"]*"|'[^']*')*?)(?:/>|>([\\s\\S]*?)</${tag}>)`, 'g');
  return [...svg.matchAll(re)].map((m) => ({
    tag,
    attrs: parseAttrs(m[1] ?? ''),
    inner: m[2] ?? '',
    index: m.index ?? 0,
    raw: m[0],
  }));
};

export const rootSvg = (svg: string): SvgElement => {
  const m = /<svg\b((?:[^>"']|"[^"]*"|'[^']*')*)>/.exec(svg);
  if (!m) throw new Error('no <svg> root');
  return { tag: 'svg', attrs: parseAttrs(m[1] ?? ''), inner: '', index: m.index, raw: m[0] };
};

export const num = (value: string | undefined): number => {
  if (value === undefined) throw new Error('missing numeric attribute');
  return Number.parseFloat(value);
};

/** Valor de um atributo de apresentação, seja atributo direto ou dentro de style="". */
export const styleOf = (el: SvgElement, name: string): string | undefined => {
  if (el.attrs[name] !== undefined) return el.attrs[name];
  const style = el.attrs.style;
  if (!style) return undefined;
  const m = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`).exec(style);
  return m?.[1]?.trim();
};

/** Conteúdo textual de um elemento (tira tags internas como <tspan>). */
export const textOf = (el: SvgElement): string => el.inner.replace(/<[^>]*>/g, '');

const RED = /^(red|#f00|#ff0000|rgb\(\s*255\s*,\s*0\s*,\s*0\s*\))$/i;
export const isRed = (value: string | undefined): boolean => value !== undefined && RED.test(value.trim());

export const isDashed = (el: SvgElement): boolean => {
  const dash = styleOf(el, 'stroke-dasharray');
  return dash !== undefined && dash !== 'none' && dash.trim() !== '';
};

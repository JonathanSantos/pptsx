import type { IconContent, LineCap, LineJoin, Rect, VectorPath } from '../core/types.ts';
import { parsePathData } from './path-data.ts';
import { parseColor } from './values.ts';

/**
 * Leitura e classificação de um ícone SVG (M12-4). Puro: recebe o texto do arquivo. Conservador:
 * vira vetor só o que tem de/para exato no custGeom (formas simples com cores sólidas, sem
 * transformação, opacidade, máscara, gradiente, texto…); na dúvida, raster com o motivo.
 */

export interface IconOptions {
  /** Cor que substitui currentColor (e preto, com recolor). */
  readonly color: string;
  readonly recolor: boolean;
}

export interface ReadIcon {
  readonly viewBox: Rect;
  readonly content: IconContent;
}

// ───────────── tokens XML ─────────────

interface Tag {
  readonly kind: 'open' | 'close' | 'self';
  readonly name: string;
  readonly attrs: Readonly<Record<string, string>>;
}

type Token = Tag | { readonly kind: 'text'; readonly text: string };

const TOKEN = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[\s\S]*?>|<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([A-Za-z][\w:.-]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
const ATTR = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

const attrsOf = (text: string): Readonly<Record<string, string>> =>
  Object.fromEntries([...text.matchAll(ATTR)].map((m) => [m[1]!, m[2] ?? m[3] ?? m[4] ?? '']));

const tokensOf = (svg: string): readonly Token[] =>
  [...svg.matchAll(TOKEN)].flatMap((m): readonly Token[] => {
    if (m[1] !== undefined) return [{ kind: 'text', text: m[1] }];
    if (m[6] !== undefined) return [{ kind: 'text', text: m[6] }];
    if (m[3] === undefined) return [];
    const kind = m[2] === '/' ? 'close' : m[5] === '/' ? 'self' : 'open';
    return [{ kind, name: m[3].toLowerCase(), attrs: attrsOf(m[4] ?? '') }];
  });

// ───────────── pintura herdada ─────────────

interface Paint {
  readonly fill: string;
  readonly stroke: string;
  readonly strokeWidth: string;
  readonly lineCap: string;
  readonly lineJoin: string;
}

/** Padrões do SVG: fill preto, sem stroke, espessura 1, ponta butt, junção miter. */
const INITIAL_PAINT: Paint = { fill: 'black', stroke: 'none', strokeWidth: '1', lineCap: 'butt', lineJoin: 'miter' };

const PAINT_KEYS: Readonly<Record<string, keyof Paint>> = {
  fill: 'fill',
  stroke: 'stroke',
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'lineCap',
  'stroke-linejoin': 'lineJoin',
};

/** Atributos que não mudam a pintura (identidade, acessibilidade, namespaces) ou que já tratamos. */
const IGNORED = /^(id|class|xmlns(:.*)?|version|xml:space|role|focusable|aria-.*|data-.*|width|height|viewbox|x|y|x1|y1|x2|y2|cx|cy|r|rx|ry|d|points|stroke-miterlimit|clip-rule|baseprofile|preserveaspectratio|enable-background|style|fill|stroke|stroke-width|stroke-linecap|stroke-linejoin)$/;

const OPAQUE = /^(1(\.0*)?|100%)$/;

/** Motivo de raster de um atributo de pintura que não tem de/para; undefined = aceito. */
const attributeProblem = (name: string, value: string): string | undefined => {
  if (name === 'transform') return 'usa transform';
  if (name === 'opacity' || name === 'fill-opacity' || name === 'stroke-opacity') return OPAQUE.test(value.trim()) ? undefined : `usa ${name}`;
  if (name === 'fill-rule') return value.trim() === 'evenodd' ? 'usa fill-rule evenodd' : undefined;
  if (name === 'stroke-dasharray') return value.trim() === 'none' ? undefined : 'usa stroke-dasharray';
  if (name === 'stroke-dashoffset') return undefined;
  if (name === 'display' || name === 'visibility') return 'usa display/visibility';
  if (IGNORED.test(name.toLowerCase())) return undefined;
  return `usa o atributo ${name}`;
};

/** `style="fill:none;stroke:#000"` → pares; o que não é pintura conhecida vira motivo de raster. */
const styleEntries = (style: string | undefined): readonly (readonly [string, string])[] =>
  (style ?? '')
    .split(';')
    .map((part) => part.split(':'))
    .filter((pair) => pair.length === 2 && pair[0]!.trim() !== '')
    .map(([name, value]) => [name!.trim().toLowerCase(), value!.trim()] as const);

interface ElementPaint {
  readonly paint: Paint;
  readonly problem?: string;
}

const paintOf = (attrs: Readonly<Record<string, string>>, inherited: Paint): ElementPaint => {
  const declared = [...Object.entries(attrs).map(([k, v]) => [k.toLowerCase(), v] as const), ...styleEntries(attrs.style)];
  const problem = declared.map(([name, value]) => attributeProblem(name, value)).find((reason) => reason !== undefined);
  const paint = declared.reduce<Paint>((acc, [name, value]) => {
    const key = PAINT_KEYS[name];
    return key === undefined ? acc : { ...acc, [key]: value.trim() };
  }, inherited);
  return problem === undefined ? { paint } : { paint, problem };
};

// ───────────── cores ─────────────

type ColorResult = { readonly color?: string } | { readonly problem: string };

const colorOf = (value: string, options: IconOptions): ColorResult => {
  const text = value.trim();
  if (text === 'none') return {};
  if (text === 'currentColor' || text === 'currentcolor') return { color: options.color };
  if (text.startsWith('url(')) return { problem: 'usa gradiente ou padrão (url)' };
  const parsed = parseColor(text);
  if (parsed === undefined) return { problem: `cor "${text}" não reconhecida` };
  if (parsed.alpha !== 1) return { problem: `cor translúcida "${text}"` };
  if (options.recolor && parsed.hex === '#000000') return { color: options.color };
  return { color: parsed.hex };
};

const CAPS: Readonly<Record<string, LineCap>> = { butt: 'flat', round: 'round' };
const JOINS: Readonly<Record<string, LineJoin>> = { miter: 'miter', round: 'round', bevel: 'bevel' };

type VectorResult = { readonly path: VectorPath } | { readonly problem: string };

const vectorOf = (d: string, paint: Paint, options: IconOptions): VectorResult => {
  const parsed = parsePathData(d);
  if ('problem' in parsed) return { problem: `caminho inválido (${parsed.problem})` };
  const fill = colorOf(paint.fill, options);
  if ('problem' in fill) return fill;
  const stroke = colorOf(paint.stroke, options);
  if ('problem' in stroke) return stroke;
  const lineCap = CAPS[paint.lineCap];
  if (stroke.color !== undefined && lineCap === undefined) return { problem: `stroke-linecap ${paint.lineCap}` };
  const lineJoin = JOINS[paint.lineJoin];
  if (stroke.color !== undefined && lineJoin === undefined) return { problem: `stroke-linejoin ${paint.lineJoin}` };
  const strokeWidth = Number.parseFloat(paint.strokeWidth);
  if (stroke.color !== undefined && !Number.isFinite(strokeWidth)) return { problem: `stroke-width ${paint.strokeWidth}` };
  return {
    path: {
      commands: parsed.commands,
      ...(fill.color === undefined ? {} : { fill: fill.color }),
      ...(stroke.color === undefined ? {} : { stroke: stroke.color, strokeWidth, lineCap, lineJoin }),
    },
  };
};

// ───────────── geometria dos elementos ─────────────

const num = (attrs: Readonly<Record<string, string>>, name: string, fallback = 0): number => {
  const value = Number.parseFloat(attrs[name] ?? '');
  return Number.isFinite(value) ? value : fallback;
};

const rectData = (a: Readonly<Record<string, string>>): string => {
  const [x, y, w, h] = [num(a, 'x'), num(a, 'y'), num(a, 'width'), num(a, 'height')];
  const rxGiven = a.rx !== undefined ? num(a, 'rx') : undefined;
  const ryGiven = a.ry !== undefined ? num(a, 'ry') : undefined;
  const rx = Math.min(rxGiven ?? ryGiven ?? 0, w / 2);
  const ry = Math.min(ryGiven ?? rxGiven ?? 0, h / 2);
  if (rx <= 0 || ry <= 0) return `M${x} ${y} H${x + w} V${y + h} H${x} Z`;
  const arc = (ex: number, ey: number) => `A${rx} ${ry} 0 0 1 ${ex} ${ey}`;
  return `M${x + rx} ${y} H${x + w - rx} ${arc(x + w, y + ry)} V${y + h - ry} ${arc(x + w - rx, y + h)} H${x + rx} ${arc(x, y + h - ry)} V${y + ry} ${arc(x + rx, y)} Z`;
};

const ellipseData = (cx: number, cy: number, rx: number, ry: number): string =>
  `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;

const pointsData = (points: string | undefined, close: boolean): string => {
  const values = (points ?? '').trim().split(/[\s,]+/).filter(Boolean);
  const pairs = values.reduce<string[]>((acc, value, index) => (index % 2 === 0 ? [...acc, `${value} ${values[index + 1] ?? 0}`] : acc), []);
  return pairs.length === 0 ? '' : `M${pairs.join(' L')}${close ? ' Z' : ''}`;
};

/** `d` de cada forma básica; undefined = não é forma. */
const shapeData = (tag: Tag): string | undefined => {
  const a = tag.attrs;
  switch (tag.name) {
    case 'path':
      return a.d ?? '';
    case 'rect':
      return rectData(a);
    case 'circle':
      return ellipseData(num(a, 'cx'), num(a, 'cy'), num(a, 'r'), num(a, 'r'));
    case 'ellipse':
      return ellipseData(num(a, 'cx'), num(a, 'cy'), num(a, 'rx'), num(a, 'ry'));
    case 'line':
      return `M${num(a, 'x1')} ${num(a, 'y1')} L${num(a, 'x2')} ${num(a, 'y2')}`;
    case 'polygon':
      return pointsData(a.points, true);
    case 'polyline':
      return pointsData(a.points, false);
    default:
      return undefined;
  }
};

// ───────────── leitura ─────────────

const CONTAINERS: ReadonlySet<string> = new Set(['svg', 'g']);
/** Conteúdo ignorado inteiro (não desenha). */
const SKIPPED: ReadonlySet<string> = new Set(['title', 'desc', 'metadata']);

interface Walk {
  readonly stack: readonly Paint[];
  readonly paths: readonly VectorPath[];
  /** Dentro de title/desc/metadata: profundidade. */
  readonly skipping: number;
  readonly problem?: string;
}

const withProblem = (walk: Walk, problem: string): Walk => (walk.problem === undefined ? { ...walk, problem } : walk);

const step = (walk: Walk, token: Token, options: IconOptions): Walk => {
  if (walk.problem !== undefined) return walk;
  if (walk.skipping > 0) {
    if (token.kind === 'open') return { ...walk, skipping: walk.skipping + 1 };
    if (token.kind === 'close') return { ...walk, skipping: walk.skipping - 1 };
    return walk;
  }
  if (token.kind === 'text') return token.text.trim() === '' ? walk : withProblem(walk, 'tem texto');
  if (token.kind === 'close') return CONTAINERS.has(token.name) ? { ...walk, stack: walk.stack.slice(0, -1) } : walk;
  if (SKIPPED.has(token.name)) return token.kind === 'open' ? { ...walk, skipping: 1 } : walk;
  // O elemento decide antes dos atributos: um <use href> é "usa <use>", não "usa href".
  const d = CONTAINERS.has(token.name) ? '' : shapeData(token);
  if (d === undefined) return withProblem(walk, `usa <${token.name}>`);
  const inherited = walk.stack.at(-1) ?? INITIAL_PAINT;
  const { paint, problem } = paintOf(token.attrs, inherited);
  if (problem !== undefined) return withProblem(walk, problem);
  if (CONTAINERS.has(token.name)) return token.kind === 'open' ? { ...walk, stack: [...walk.stack, paint] } : walk;
  const vector = vectorOf(d, paint, options);
  if ('problem' in vector) return withProblem(walk, vector.problem);
  return { ...walk, paths: [...walk.paths, vector.path] };
};

const numbers = (text: string | undefined): readonly number[] =>
  (text ?? '').trim().split(/[\s,]+/).filter(Boolean).map(Number.parseFloat);

/** viewBox do SVG; sem ele, width/height; sem nada, 24 × 24 (o tamanho mais comum de ícone). */
const viewBoxOf = (root: Tag | undefined): Rect => {
  const [x, y, width, height] = numbers(root?.attrs.viewBox ?? root?.attrs.viewbox);
  if ([x, y, width, height].every((value) => value !== undefined && Number.isFinite(value)) && width! > 0 && height! > 0) {
    return { x: x!, y: y!, width: width!, height: height! };
  }
  const w = root === undefined ? Number.NaN : num(root.attrs, 'width', Number.NaN);
  const h = root === undefined ? Number.NaN : num(root.attrs, 'height', Number.NaN);
  return w > 0 && h > 0 ? { x: 0, y: 0, width: w, height: h } : { x: 0, y: 0, width: DEFAULT_SIDE, height: DEFAULT_SIDE };
};

const DEFAULT_SIDE = 24;

const BLACK_PAINT = /\b(fill|stroke)\s*=\s*(["'])(?:#000|#000000|black)\2/gi;

/** SVG para o raster: currentColor (e, com recolor, preto) já trocados pela cor do ícone. */
export const recoloredSvg = (svg: string, options: IconOptions): string => {
  const current = svg.replace(/currentColor/gi, options.color);
  return options.recolor ? current.replace(BLACK_PAINT, (_m, attr: string, quote: string) => `${attr}=${quote}${options.color}${quote}`) : current;
};

const isTag = (token: Token): token is Tag => token.kind !== 'text';

/** Lê o SVG; `forceImage` pula a classificação (render="image"). */
export const readIcon = (svg: string, options: IconOptions, forceImage = false): ReadIcon => {
  const tokens = tokensOf(svg);
  const root = tokens.filter(isTag).find((tag) => tag.name === 'svg');
  const viewBox = viewBoxOf(root);
  const raster = (reason: string): ReadIcon => ({ viewBox, content: { raster: true, svg: recoloredSvg(svg, options), reason } });
  if (root === undefined) return raster('o arquivo não tem <svg>');
  if (forceImage) return raster('render="image"');
  const walk = tokens.reduce<Walk>((acc, token) => step(acc, token, options), { stack: [], paths: [], skipping: 0 });
  if (walk.problem !== undefined) return raster(walk.problem);
  if (walk.paths.length === 0) return raster('nenhuma forma desenhável');
  return { viewBox, content: { paths: walk.paths } };
};

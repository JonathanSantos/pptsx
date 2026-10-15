import { DEFAULTS } from '../core/defaults.ts';
import type {
  ConnectorSide,
  Diagnostic,
  LayoutEnv,
  PositionedConnector,
  PositionedNode,
  PositionedSlide,
  PositionedText,
  Pt,
  Rect,
  ResolvedConnector,
  Side,
} from '../core/types.ts';
import { measureInputOf } from '../layout/index.ts';
import type { DiagnosticContext } from './diagnostics.ts';

/**
 * Conectores (M12-5): etapa pós-layout, depois do ajuste de cada parte do slide. Não participam
 * do layout nem do fit: ligam os border-boxes (sem rotação) pelos lados escolhidos. Puro.
 */

interface Point {
  readonly x: Pt;
  readonly y: Pt;
}

const SIDES: readonly Side[] = ['top', 'right', 'bottom', 'left'];

/** Ponto médio do lado do frame. */
export const anchorOf = (frame: Rect, side: Side): Point => {
  const cx = frame.x + frame.width / 2;
  const cy = frame.y + frame.height / 2;
  const anchors: Readonly<Record<Side, Point>> = {
    top: { x: cx, y: frame.y },
    right: { x: frame.x + frame.width, y: cy },
    bottom: { x: cx, y: frame.y + frame.height },
    left: { x: frame.x, y: cy },
  };
  return anchors[side];
};

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

const candidatesOf = (side: ConnectorSide | undefined): readonly Side[] => (side === undefined || side === 'auto' ? SIDES : [side]);

/** `auto` escolhe, entre os lados permitidos, o par de âncoras mais próximo (o primeiro em empate). */
export const sidesOf = (from: Rect, to: Rect, fromSide?: ConnectorSide, toSide?: ConnectorSide): readonly [Side, Side] => {
  const pairs = candidatesOf(fromSide).flatMap((a) => candidatesOf(toSide).map((b) => [a, b] as const));
  return pairs.reduce((best, pair) =>
    distance(anchorOf(from, pair[0]), anchorOf(to, pair[1])) < distance(anchorOf(from, best[0]), anchorOf(to, best[1])) ? pair : best,
  );
};

const isHorizontal = (side: Side): boolean => side === 'left' || side === 'right';

/** Remove pontos repetidos e os do meio de trechos colineares (cotovelo alinhado vira reta). */
export const simplify = (points: readonly Point[]): readonly Point[] => {
  const unique = points.filter((point, index) => index === 0 || distance(point, points[index - 1]!) > DEFAULTS.css.layoutNoise);
  return unique.filter((point, index) => {
    const before = unique[index - 1];
    const after = unique[index + 1];
    if (before === undefined || after === undefined) return true;
    const cross = (point.x - before.x) * (after.y - point.y) - (point.y - before.y) * (after.x - point.x);
    return Math.abs(cross) > DEFAULTS.css.layoutNoise;
  });
};

/** Lado igual nas duas pontas: a dobra fica fora dos dois nós, a esta distância. */
const SAME_SIDE_OFFSET = DEFAULTS.connector.elbowOffset;

/**
 * Cotovelo: lados no mesmo eixo = 3 segmentos com a dobra no meio desse eixo (lados iguais: a
 * dobra sai para fora dos nós); eixos mistos = um L que sai pelo lado de `from`.
 */
export const elbowOf = (a: Point, b: Point, fromSide: Side, toSide: Side): readonly Point[] => {
  if (isHorizontal(fromSide) !== isHorizontal(toSide)) {
    return isHorizontal(fromSide) ? [a, { x: b.x, y: a.y }, b] : [a, { x: a.x, y: b.y }, b];
  }
  if (isHorizontal(fromSide)) {
    const x =
      fromSide !== toSide ? (a.x + b.x) / 2 : fromSide === 'right' ? Math.max(a.x, b.x) + SAME_SIDE_OFFSET : Math.min(a.x, b.x) - SAME_SIDE_OFFSET;
    return [a, { x, y: a.y }, { x, y: b.y }, b];
  }
  const y =
    fromSide !== toSide ? (a.y + b.y) / 2 : fromSide === 'bottom' ? Math.max(a.y, b.y) + SAME_SIDE_OFFSET : Math.min(a.y, b.y) - SAME_SIDE_OFFSET;
  return [a, { x: a.x, y }, { x: b.x, y }, b];
};

export const routeOf = (connector: Pick<ResolvedConnector, 'props'>, from: Rect, to: Rect): readonly Point[] => {
  const [fromSide, toSide] = sidesOf(from, to, connector.props.fromSide, connector.props.toSide);
  const a = anchorOf(from, fromSide);
  const b = anchorOf(to, toSide);
  return simplify(connector.props.route === 'elbow' ? elbowOf(a, b, fromSide, toSide) : [a, b]);
};

/** Meio do segmento mais longo (o primeiro em empate): onde o rótulo fica. */
export const labelAnchorOf = (points: readonly Point[]): Point => {
  const segments = points.slice(1).map((end, index) => [points[index]!, end] as const);
  const [start, end] = segments.reduce((best, segment) => (distance(...segment) > distance(...best) ? segment : best), segments[0]!);
  return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
};

const NO_BOX = { margin: { top: 0, right: 0, bottom: 0, left: 0 }, border: { top: 0, right: 0, bottom: 0, left: 0 }, padding: { top: 0, right: 0, bottom: 0, left: 0 } };

const labelOf = (connector: ResolvedConnector, points: readonly Point[], env: LayoutEnv): PositionedConnector['label'] => {
  const label = connector.label;
  if (label === undefined) return undefined;
  const layout = env.measureText(measureInputOf(label, Number.POSITIVE_INFINITY));
  const center = labelAnchorOf(points);
  const frame: Rect = { x: center.x - layout.width / 2, y: center.y - layout.height / 2, width: layout.width, height: layout.height };
  const text: PositionedText = { ...label, frame, box: NO_BOX, text: layout };
  const pad = DEFAULTS.connector.label.padding;
  const background = connector.props.labelStyle?.background;
  return {
    frame: { x: frame.x - pad, y: frame.y - pad, width: frame.width + 2 * pad, height: frame.height + 2 * pad },
    text,
    ...(background === undefined ? {} : { background }),
  };
};

// ───────────── nós com id ─────────────

const nodesOf = (nodes: readonly PositionedNode[]): readonly PositionedNode[] =>
  nodes.flatMap((node) => (node.kind === 'box' ? [node, ...nodesOf(node.children)] : [node]));

/** id → frame dos nós desta parte do slide. */
export const framesById = (slide: PositionedSlide): ReadonlyMap<string, Rect> =>
  new Map(nodesOf(slide.children).flatMap((node) => (node.props.id === undefined ? [] : [[node.props.id, node.frame] as const])));

// ───────────── diagnósticos ─────────────

const quoted = (ids: Iterable<string>): string => [...ids].map((id) => `"${id}"`).join(', ') || '(nenhum)';

const targetMissing = (ctx: DiagnosticContext, connector: ResolvedConnector, known: Iterable<string>): Diagnostic => {
  const ends = (connector.missing ?? []).map((end) => `${end}="${connector.props[end]}"`).join(' e ');
  return {
    severity: 'error',
    code: 'connector-target-missing',
    size: ctx.size,
    slide: ctx.slide,
    path: connector.path,
    message: `O Connector aponta para ${ends}, mas nenhum nó do slide tem esse id; o conector não foi desenhado. Ponha id="…" no nó de destino (ids do slide: ${quoted(known)}).`,
  };
};

const omitted = (ctx: DiagnosticContext, connector: ResolvedConnector): Diagnostic => ({
  severity: 'info',
  code: 'connector-omitted',
  size: ctx.size,
  slide: ctx.slide,
  path: connector.path,
  message: `O Connector de "${connector.props.from}" para "${connector.props.to}" foi omitido: com a paginação, as duas pontas caíram em slides diferentes. Para mantê-lo, tire um dos nós do Box paginate ou encurte a lista.`,
});

export interface RoutedConnectors {
  readonly connectors: readonly PositionedConnector[];
  readonly diagnostics: readonly Diagnostic[];
}

export interface RouteInput {
  readonly slide: PositionedSlide;
  readonly connectors: readonly ResolvedConnector[];
  readonly env: LayoutEnv;
  readonly ctx: DiagnosticContext;
  /** Ids do slide do autor inteiro (todas as partes): a mensagem de id ausente lista estes. */
  readonly knownIds: Iterable<string>;
  /** Só a 1ª parte reporta id ausente (as demais repetiriam o mesmo erro). */
  readonly firstPart: boolean;
}

/**
 * Conectores de uma parte: desenhados quando as duas pontas estão nela; id ausente → error (só na
 * 1ª parte); pontas em partes diferentes → info na parte que tem `from`.
 */
export const routeConnectors = ({ slide, connectors, env, ctx, knownIds, firstPart }: RouteInput): RoutedConnectors => {
  const frames = framesById(slide);
  const results = connectors.map((connector): { readonly drawn?: PositionedConnector; readonly diagnostic?: Diagnostic } => {
    if (connector.missing !== undefined) return firstPart ? { diagnostic: targetMissing(ctx, connector, knownIds) } : {};
    const from = frames.get(connector.props.from);
    const to = frames.get(connector.props.to);
    if (from === undefined) return {};
    if (to === undefined) return { diagnostic: omitted(ctx, connector) };
    const points = routeOf(connector, from, to);
    const label = labelOf(connector, points, env);
    const { kind, path, props } = connector;
    return { drawn: { kind, path, props, points, ...(label === undefined ? {} : { label }) } };
  });
  return {
    connectors: results.flatMap((result) => (result.drawn === undefined ? [] : [result.drawn])),
    diagnostics: results.flatMap((result) => (result.diagnostic === undefined ? [] : [result.diagnostic])),
  };
};

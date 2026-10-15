import { DEFAULTS } from '../core/defaults.ts';
import type { ConnectorProps, ResolvedConnector, ResolvedNode, ResolvedText, TextChildren } from '../core/types.ts';
import { withHexFields } from './colors.ts';
import type { InheritedText } from './draft.ts';
import { CONNECTOR_KEYS } from './connector-keys.ts';
import { ResolveError } from './errors.ts';
import { legacyPropsOf } from './legacy.ts';
import { normalizeProps } from './normalize.ts';
import { runsOf } from './runs.ts';
import { ARROW_TYPES, assertOneOf, LINE_STYLES } from './shape.ts';

/**
 * Connector (M12-5): sai da árvore de layout e vai para `ResolvedSlide.connectors`. Aqui: validação
 * das props, o rótulo como um Text resolvido e, no slide inteiro, ids únicos e pontas ausentes.
 */

type ConnectorResolvedProps = Omit<ConnectorProps, 'label'>;

const SIDES = ['top', 'right', 'bottom', 'left', 'auto'] as const;
const ROUTES = ['straight', 'elbow'] as const;

const assertTarget = (value: unknown, name: 'from' | 'to', path: string): void => {
  if (typeof value === 'string' && value.trim() !== '') return;
  throw new ResolveError(`<Connector> precisa de ${name}: o id de um nó do mesmo slide`, path);
};

const assertProps = (props: ConnectorResolvedProps, path: string): void => {
  assertTarget(props.from, 'from', path);
  assertTarget(props.to, 'to', path);
  assertOneOf(props.fromSide, SIDES, '<Connector>: fromSide', path);
  assertOneOf(props.toSide, SIDES, '<Connector>: toSide', path);
  assertOneOf(props.route, ROUTES, '<Connector>: route', path);
  assertOneOf(props.startArrow, ARROW_TYPES, '<Connector>: startArrow', path);
  assertOneOf(props.endArrow, ARROW_TYPES, '<Connector>: endArrow', path);
  assertOneOf(props.lineStyle, LINE_STYLES, '<Connector>: lineStyle', path);
  if (props.strokeWidth !== undefined && !(typeof props.strokeWidth === 'number' && props.strokeWidth > 0)) {
    throw new ResolveError(`<Connector>: strokeWidth ${JSON.stringify(props.strokeWidth)} inválido; use um número positivo (pt)`, path);
  }
};

/** Rótulo = Text de uma linha, centrado, com a tipografia de labelStyle (fonte herdada do pai). */
const labelOf = (label: TextChildren, props: ConnectorResolvedProps, path: string, parentText: InheritedText): ResolvedText | undefined => {
  const style = withHexFields('labelStyle', props.labelStyle ?? {}, ['color', 'background']);
  const own = {
    ...(style.font === undefined ? {} : { fontFamily: style.font }),
    fontSize: style.fontSize ?? DEFAULTS.connector.label.size,
    color: style.color ?? DEFAULTS.connector.label.color,
    textAlign: 'center',
    whiteSpace: 'nowrap',
  };
  const n = normalizeProps('text', own, parentText);
  const labelPath = `${path} > Label`;
  const runs = runsOf(label, {
    weight: n.text.weight ?? DEFAULTS.text.weight,
    italic: n.text.italic ?? DEFAULTS.text.italic,
    color: n.text.color ?? DEFAULTS.text.color,
    underline: false,
    lineThrough: false,
  }, n.css.textTransform, labelPath);
  const content = runs.map((run) => run.text).join('');
  if (content === '') return undefined;
  return { kind: 'text', path: labelPath, props: legacyPropsOf('text', n), css: n.css, content, runs };
};


const assertKnownKeys = (author: Readonly<Record<string, unknown>>, path: string): void => {
  const unknown = Object.keys(author).filter((key) => !CONNECTOR_KEYS.includes(key));
  if (unknown.length === 0) return;
  throw new ResolveError(`<Connector> não aceita ${unknown.map((key) => `"${key}"`).join(', ')}: ele não é uma caixa (use ${CONNECTOR_KEYS.join(', ')})`, path);
};

/** `author` = props do autor (só para validar as chaves); `raw` = as mesmas já normalizadas (cores em hex). */
export const resolveConnector = (
  author: Readonly<Record<string, unknown>>,
  raw: Readonly<Record<string, unknown>>,
  path: string,
  parentText: InheritedText,
): ResolvedConnector => {
  assertKnownKeys(author, path);
  const { label, ...rest } = raw as unknown as ConnectorProps;
  const props = rest as ConnectorResolvedProps;
  assertProps(props, path);
  const resolvedLabel = label === undefined ? undefined : labelOf(label, props, path, parentText);
  return { kind: 'connector', path, props, ...(resolvedLabel === undefined ? {} : { label: resolvedLabel }) };
};

// ───────────── slide inteiro ─────────────

interface IdOwner {
  readonly id: string;
  readonly path: string;
}

const idOwnersOf = (nodes: readonly ResolvedNode[]): readonly IdOwner[] =>
  nodes.flatMap((node) => [
    ...(node.props.id === undefined ? [] : [{ id: node.props.id, path: node.path }]),
    ...(node.kind === 'box' ? idOwnersOf(node.children) : []),
  ]);

/** Ids do slide; o segundo nó com o mesmo id → ResolveError apontando o primeiro. */
export const slideIdsOf = (nodes: readonly ResolvedNode[]): ReadonlySet<string> => {
  const owners = idOwnersOf(nodes);
  owners.forEach((owner, index) => {
    const first = owners.findIndex((other) => other.id === owner.id);
    if (first === index) return;
    throw new ResolveError(`id "${owner.id}" repetido no slide (já usado em ${owners[first]!.path}); ids têm que ser únicos por slide`, owner.path);
  });
  return new Set(owners.map((owner) => owner.id));
};

/** Pontas cujo id não existe no slide: o fit emite connector-target-missing. */
export const withMissing = (connector: ResolvedConnector, ids: ReadonlySet<string>): ResolvedConnector => {
  const missing = (['from', 'to'] as const).filter((end) => !ids.has(connector.props[end]));
  return missing.length === 0 ? connector : { ...connector, missing };
};

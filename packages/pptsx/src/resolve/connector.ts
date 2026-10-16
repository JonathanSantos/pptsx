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
  /** Path da instância de componente mais próxima que contém o nó ('' = o próprio slide). */
  readonly scope: string;
}

const idOwnersOf = (nodes: readonly ResolvedNode[], scope = ''): readonly IdOwner[] =>
  nodes.flatMap((node) => {
    const own = node.component === undefined ? scope : node.path;
    return [
      ...(node.props.id === undefined ? [] : [{ id: node.props.id, path: node.path, scope: own }]),
      ...(node.kind === 'box' ? idOwnersOf(node.children, own) : []),
    ];
  });

/** Paths das instâncias de componente do slide (raízes com `component`), para achar o escopo de um conector. */
const componentRootsOf = (nodes: readonly ResolvedNode[]): readonly string[] =>
  nodes.flatMap((node) => [...(node.component === undefined ? [] : [node.path]), ...(node.kind === 'box' ? componentRootsOf(node.children) : [])]);

const within = (path: string, scope: string): boolean => scope === '' || path === scope || path.startsWith(`${scope} > `);

/**
 * Ids com escopo de componente: o mesmo id pode se repetir em instâncias diferentes de componente (um Flow
 * repetido numa grade), nunca dentro do mesmo escopo. Cada repetição ganha um id interno único (`id#2`, …) e
 * cada conector se liga à ocorrência do seu escopo, subindo para os componentes de fora; empate → ResolveError.
 * Ids únicos no slide saem exatamente como o autor escreveu (nada muda para quem não repete).
 */
export interface ScopedIds {
  readonly nodes: readonly ResolvedNode[];
  readonly connectors: readonly ResolvedConnector[];
  readonly ids: ReadonlySet<string>;
}

const assertUniqueInScope = (owners: readonly IdOwner[]): void =>
  owners.forEach((owner, index) => {
    const first = owners.findIndex((other) => other.id === owner.id && other.scope === owner.scope);
    if (first === index) return;
    throw new ResolveError(`id "${owner.id}" repetido no slide (já usado em ${owners[first]!.path}); ids têm que ser únicos por slide (ou por instância de componente)`, owner.path);
  });

/** Id final de cada dono: o 1º de cada id fica como está; as repetições ganham sufixo. */
const finalIdsOf = (owners: readonly IdOwner[]): ReadonlyMap<string, string> => {
  const seen = new Map<string, number>();
  return new Map(owners.map((owner) => {
    const count = (seen.get(owner.id) ?? 0) + 1;
    seen.set(owner.id, count);
    return [owner.path, count === 1 ? owner.id : `${owner.id}#${count}`];
  }));
};

/** Escopos do conector, do mais interno ao slide. */
const scopesOf = (path: string, roots: readonly string[]): readonly string[] =>
  [...roots.filter((root) => within(path, root)).sort((a, b) => b.length - a.length), ''];

const bindEnd = (id: string, connector: ResolvedConnector, owners: readonly IdOwner[], roots: readonly string[]): IdOwner | undefined => {
  const named = owners.filter((owner) => owner.id === id);
  if (named.length <= 1) return named[0];
  for (const scope of scopesOf(connector.path, roots)) {
    const visible = named.filter((owner) => within(owner.path, scope));
    if (visible.length === 0) continue;
    const exact = visible.filter((owner) => owner.scope === scope);
    if (visible.length === 1) return visible[0];
    if (exact.length === 1) return exact[0];
    throw new ResolveError(`id "${id}" ambíguo para o conector: existe em ${visible.map((owner) => owner.path).join(', ')}; declare o conector dentro do componente do nó que ele liga`, connector.path);
  }
  return undefined;
};

const renameIds = (nodes: readonly ResolvedNode[], finals: ReadonlyMap<string, string>): readonly ResolvedNode[] =>
  nodes.map((node) => {
    const renamed = node.props.id === undefined || finals.get(node.path) === node.props.id ? node : { ...node, props: { ...node.props, id: finals.get(node.path)! } };
    return renamed.kind === 'box' ? { ...renamed, children: renameIds(renamed.children, finals) } : renamed;
  }) as readonly ResolvedNode[];

export const scopeIds = (nodes: readonly ResolvedNode[], connectors: readonly ResolvedConnector[]): ScopedIds => {
  const owners = idOwnersOf(nodes);
  assertUniqueInScope(owners);
  const repeated = owners.some((owner, index) => owners.findIndex((other) => other.id === owner.id) !== index);
  if (!repeated) return { nodes, connectors, ids: new Set(owners.map((owner) => owner.id)) };
  const roots = componentRootsOf(nodes);
  const finals = finalIdsOf(owners);
  const endOf = (connector: ResolvedConnector, end: 'from' | 'to'): string => {
    const owner = bindEnd(connector.props[end], connector, owners, roots);
    return owner === undefined ? connector.props[end] : finals.get(owner.path)!;
  };
  return {
    nodes: renameIds(nodes, finals),
    connectors: connectors.map((connector) => ({ ...connector, props: { ...connector.props, from: endOf(connector, 'from'), to: endOf(connector, 'to') } })),
    ids: new Set(finals.values()),
  };
};

/** Pontas cujo id não existe no slide: o fit emite connector-target-missing. */
export const withMissing = (connector: ResolvedConnector, ids: ReadonlySet<string>): ResolvedConnector => {
  const missing = (['from', 'to'] as const).filter((end) => !ids.has(connector.props[end]));
  return missing.length === 0 ? connector : { ...connector, missing };
};

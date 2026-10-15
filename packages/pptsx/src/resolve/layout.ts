import { DEFAULTS } from '../core/defaults.ts';
import type {
  Children,
  DeckSection,
  LayoutDefinition,
  PlaceholderName,
  ResolvedLayout,
  ResolvedNode,
  ResolvedNotes,
  SlideElement,
  TextChildren,
} from '../core/types.ts';
import { jsx } from '../jsx/jsx-runtime.ts';
import { Box } from '../primitives/index.ts';
import { hexOf } from './colors.ts';
import { ResolveError } from './errors.ts';
import { runsOf } from './runs.ts';

/**
 * M15: o que o arquivo carrega além dos objetos do slide — layout (`defineLayout`) com placeholders e
 * conteúdo fixo, notas com estilo, seções. Validação no resolve, como o resto da estrutura.
 */

/** Nome do invólucro do conteúdo fixo: o path fica `Slide > Fixed > …`. */
export const FIXED_SEGMENT = 'Fixed';

/**
 * Conteúdo fixo do layout: absoluto do tamanho do slide e atrás do conteúdo (zIndex -1), como fica
 * no PowerPoint, onde o master é desenhado antes dos objetos do slide.
 */
function Fixed({ children }: { readonly children?: Children }): SlideElement {
  return jsx(Box, { position: 'absolute', inset: 0, zIndex: -1, children });
}

const isEmpty = (children: Children | undefined): boolean => children === undefined || children === null || children === false;

/** Filhos do slide com o conteúdo fixo do layout no fim (os índices dos irmãos do autor não mudam). */
export const withFixed = (children: Children, layout: LayoutDefinition | undefined): Children =>
  layout === undefined || isEmpty(layout.fixed) ? children : [children, jsx(Fixed, { children: layout.fixed })];

const backgroundOf = (background: LayoutDefinition['background'], path: string): ResolvedLayout['background'] => {
  if (background === undefined || typeof background === 'object') return background;
  try {
    return hexOf('background', background);
  } catch {
    throw new ResolveError(`defineLayout: background ${JSON.stringify(background)} inválido; use uma cor ou { image }`, path);
  }
};

const assertLayoutDefinition = (layout: LayoutDefinition, path: string): void => {
  if (typeof layout.name !== 'string' || layout.name.trim() === '') throw new ResolveError('defineLayout: o nome do layout não pode ser vazio', path);
  if (!Array.isArray(layout.placeholders)) throw new ResolveError(`defineLayout("${layout.name}"): placeholders tem que ser uma lista de nomes`, path);
  const repeated = layout.placeholders.find((name, index) => layout.placeholders.indexOf(name) !== index);
  if (repeated !== undefined) throw new ResolveError(`defineLayout("${layout.name}"): placeholder "${repeated}" repetido`, path);
  const blank = layout.placeholders.find((name) => typeof name !== 'string' || name.trim() === '');
  if (blank !== undefined) throw new ResolveError(`defineLayout("${layout.name}"): nome de placeholder vazio`, path);
};

export const resolvedLayoutOf = (layout: LayoutDefinition, slidePath: string): ResolvedLayout => {
  assertLayoutDefinition(layout, slidePath);
  const background = backgroundOf(layout.background, slidePath);
  return {
    name: layout.name,
    placeholders: layout.placeholders,
    ...(background === undefined ? {} : { background }),
    ...(isEmpty(layout.fixed) ? {} : { fixedPath: `${slidePath} > ${FIXED_SEGMENT}` }),
  };
};

// ───────────── placeholders ─────────────

interface Marked {
  readonly name: PlaceholderName;
  readonly path: string;
}

const placeholderOf = (node: ResolvedNode): PlaceholderName | undefined => {
  if (node.kind !== 'text' && node.kind !== 'image' && node.kind !== 'box') return undefined;
  const value = (node.props as { readonly placeholder?: unknown }).placeholder;
  return typeof value === 'string' ? value : undefined;
};

const markedOf = (nodes: readonly ResolvedNode[]): readonly Marked[] =>
  nodes.flatMap((node): readonly Marked[] => {
    const name = placeholderOf(node);
    const own = name === undefined ? [] : [{ name, path: node.path }];
    return node.kind === 'box' ? [...own, ...markedOf(node.children)] : own;
  });

/** Nós marcados com `placeholder` precisam de um layout que declare o nome, uma vez por slide. */
export const assertPlaceholders = (children: readonly ResolvedNode[], layout: ResolvedLayout | undefined): void => {
  const marked = markedOf(children);
  marked.forEach((item, index) => {
    if (layout === undefined) {
      throw new ResolveError(`placeholder="${item.name}" fora de um layout: o <Slide> precisa vir de um componente defineLayout(…)`, item.path);
    }
    if (!layout.placeholders.includes(item.name)) {
      const known = layout.placeholders.map((name) => `"${name}"`).join(', ') || 'nenhum';
      throw new ResolveError(`placeholder="${item.name}" não existe no layout "${layout.name}" (declarados: ${known})`, item.path);
    }
    if (marked.findIndex((other) => other.name === item.name) !== index) {
      throw new ResolveError(`placeholder="${item.name}" usado duas vezes no mesmo slide`, item.path);
    }
  });
};

/** Placeholders do layout que nenhum nó do slide marca. */
export const unusedPlaceholdersOf = (children: readonly ResolvedNode[], layout: ResolvedLayout): readonly PlaceholderName[] => {
  const used = new Set(markedOf(children).map((item) => item.name));
  return layout.placeholders.filter((name) => !used.has(name));
};

export const placeholderTypeOf = (name: PlaceholderName): string => DEFAULTS.placeholder.types[name] ?? DEFAULTS.placeholder.fallbackType;

// ───────────── notas ─────────────

const NOTES_STYLE = { weight: DEFAULTS.text.weight, italic: false, color: DEFAULTS.text.color, underline: false, lineThrough: false } as const;

export const notesOf = (notes: unknown, path: string): ResolvedNotes | undefined => {
  if (notes === undefined || notes === null || notes === false || notes === '') return undefined;
  const runs = runsOf(notes as TextChildren, NOTES_STYLE, 'none', `${path} > notes`);
  const content = runs.map((run) => run.text).join('');
  return content === '' ? undefined : { content, runs };
};

// ───────────── seções ─────────────

const isSection = (value: unknown): value is DeckSection =>
  typeof value === 'object' && value !== null && typeof (value as DeckSection).title === 'string' && typeof (value as DeckSection).from === 'number';

/** Seções em ordem estrita de `from`, cada uma num slide que existe; título não vazio. */
export const sectionsOf = (sections: unknown, slideCount: number): readonly DeckSection[] | undefined => {
  if (sections === undefined) return undefined;
  if (!Array.isArray(sections)) throw new ResolveError('<Deck sections>: use uma lista de { title, from }', 'Deck');
  sections.forEach((section: unknown, index) => {
    const label = `<Deck sections>: a seção ${index + 1}`;
    if (!isSection(section)) throw new ResolveError(`${label} precisa de { title: texto, from: número do slide }`, 'Deck');
    if (section.title.trim() === '') throw new ResolveError(`${label} tem título vazio`, 'Deck');
    if (!Number.isInteger(section.from) || section.from < 1 || section.from > slideCount) {
      throw new ResolveError(`${label} ("${section.title}") começa no slide ${section.from}; o deck tem ${slideCount} slides (use 1 a ${slideCount})`, 'Deck');
    }
    if (sections.findIndex((other: DeckSection) => other.title === section.title) !== index) {
      throw new ResolveError(`${label} repete o título "${section.title}": cada seção precisa de um título próprio`, 'Deck');
    }
    const previous = sections[index - 1] as DeckSection | undefined;
    if (previous !== undefined && section.from <= previous.from) {
      throw new ResolveError(`${label} ("${section.title}") começa no slide ${section.from}, não depois da anterior (${previous.from}): ordene por from, sem repetir`, 'Deck');
    }
  });
  return sections.length === 0 ? undefined : sections;
};

/** Dois layouts diferentes com o mesmo nome dariam dois masters indistinguíveis no PowerPoint. */
export const assertUniqueLayoutNames = (layouts: readonly (readonly [LayoutDefinition, string])[]): void => {
  layouts.reduce((byName, [layout, path]) => {
    const seen = byName.get(layout.name);
    if (seen !== undefined && seen !== layout) throw new ResolveError(`Dois layouts diferentes com o nome "${layout.name}": dê nomes distintos no defineLayout`, path);
    return new Map(byName).set(layout.name, layout);
  }, new Map<string, LayoutDefinition>());
};

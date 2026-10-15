import { COMPONENT_META, defineDs, type Component, type ComponentCatalogCase, type ComponentMeta, type DsManifest, type LintRule, type Theme } from 'pptsx';
import { checkTheme } from './theme.ts';

/**
 * `createDs`: monta o `DsManifest` do núcleo a partir das funções dos componentes (o núcleo só guarda os
 * metas; o catálogo precisa das funções, que ficam em `implementations`). O guia junta as partes em
 * markdown; o tema passa pelo `checkTheme` (os avisos ficam em `warnings`).
 */

/** Um caso do catálogo (o do núcleo): nome, props do componente e `fill?`. Fica em `meta.catalog`. */
export type CatalogCase<P = Readonly<Record<string, unknown>>> = ComponentCatalogCase<P>;

export interface DsInput {
  readonly name: string;
  readonly version: string;
  readonly components: readonly Component[];
  readonly theme?: Theme;
  readonly rules?: readonly LintRule[];
  /** Markdown do guia: um texto ou partes (cada uma vira uma seção `##`). */
  readonly guide?: string | readonly GuidePart[];
  readonly schema?: Readonly<Record<string, unknown>>;
  readonly examples?: readonly string[];
}

export interface GuidePart {
  readonly title: string;
  readonly markdown: string;
}

export interface Ds extends DsManifest {
  /** Funções dos componentes, na ordem de `components` (o catálogo renderiza com elas). */
  readonly implementations: readonly Component[];
  /** Avisos de montagem (contraste do tema). */
  readonly warnings: readonly string[];
}

export const metaOfComponent = (component: Component): ComponentMeta => {
  const meta = component[COMPONENT_META];
  if (meta === undefined) throw new Error(`createDs: "${component.name || 'anônimo'}" não foi criado com defineComponent (o DS precisa da identidade dele)`);
  return meta;
};

/** Guia em partes → um markdown com uma seção `##` por parte (o `guide` do MCP navega por elas). */
export const guideOf = (title: string, parts: readonly GuidePart[]): string =>
  [`# ${title}`, ...parts.map((part) => `## ${part.title}\n\n${part.markdown.trim()}`)].join('\n\n') + '\n';

// ───────────── padrões automáticos (M18-2) ─────────────

interface MetaPropSchema {
  readonly type: string;
  readonly examples: readonly unknown[];
}

const typeOfValue = (value: unknown): string => {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  if (typeof value === 'object') return '$$typeof' in (value as object) || 'type' in (value as object) ? 'element' : 'object';
  return typeof value;
};

/**
 * Schema de props sem ler os tipos: o que os casos do catálogo e os `defaults` mostram (nome, tipo do valor,
 * exemplos; obrigatória = presente em todo caso). Fica no formato do `schema` do núcleo. Para os tipos
 * completos, gere com `schemaOf` e passe `schema` ao `createDs`.
 */
export const schemaFromMeta = (meta: ComponentMeta): Readonly<Record<string, unknown>> => {
  const cases = (Array.isArray(meta.catalog) ? meta.catalog : []) as readonly CatalogCase[];
  const defaults = (meta.defaults ?? {}) as Readonly<Record<string, unknown>>;
  const samples = [...cases.map((item) => item.props), defaults];
  const names = [...new Set(samples.flatMap((props) => Object.keys(props)))];
  const properties = Object.fromEntries(
    names.map((name): readonly [string, MetaPropSchema] => {
      const values = samples.map((props) => props[name]).filter((value) => value !== undefined);
      const types = [...new Set(values.map(typeOfValue))];
      const examples = values.filter((value) => typeOfValue(value) !== 'element' && typeOfValue(value) !== 'object').slice(0, 3);
      return [name, { type: types.join(' | '), examples: [...new Set(examples.map((value) => JSON.stringify(value)))].map((text) => JSON.parse(text) as unknown) }];
    }),
  );
  const required = cases.length === 0 ? [] : names.filter((name) => cases.every((item) => item.props[name] !== undefined) && !(name in defaults));
  return { type: 'object', properties, required, 'x-source': 'catálogo e defaults (sem os tipos; para os tipos, schemaOf)' };
};

/** Guia montado dos `meta.guide` (markdown) dos componentes, uma seção por componente. */
const guideFromMetas = (name: string, metas: readonly ComponentMeta[]): string | undefined => {
  const parts = metas.flatMap((meta): readonly GuidePart[] => (typeof meta.guide === 'string' ? [{ title: meta.displayName ?? meta.name, markdown: meta.guide }] : []));
  return parts.length === 0 ? undefined : guideOf(name, parts);
};

export const createDs = (input: DsInput): Ds => {
  const metas = input.components.map(metaOfComponent);
  const guide = input.guide === undefined ? guideFromMetas(input.name, metas) : typeof input.guide === 'string' ? input.guide : guideOf(input.name, input.guide);
  const schema = input.schema ?? Object.fromEntries(metas.map((meta) => [meta.name, schemaFromMeta(meta)]));
  const manifest = defineDs({
    name: input.name,
    version: input.version,
    components: metas.map((meta) => ({ ...meta, ds: meta.ds ?? input.name })),
    rules: input.rules ?? [],
    ...(input.theme === undefined ? {} : { theme: input.theme }),
    ...(guide === undefined ? {} : { guide }),
    schema,
    ...(input.examples === undefined ? {} : { examples: input.examples }),
  });
  return Object.freeze({ ...manifest, implementations: input.components, warnings: input.theme === undefined ? [] : checkTheme(input.theme) });
};

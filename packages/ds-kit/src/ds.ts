import { COMPONENT_META, defineDs, type Component, type ComponentMeta, type DsManifest, type LintRule, type Theme } from 'pptsx';
import { checkTheme } from './theme.ts';

/**
 * `createDs`: monta o `DsManifest` do núcleo a partir das funções dos componentes (o núcleo só guarda os
 * metas; o catálogo precisa das funções, que ficam em `implementations`). O guia junta as partes em
 * markdown; o tema passa pelo `checkTheme` (os avisos ficam em `warnings`).
 */

/** Um caso do catálogo: nome e props. Fica em `meta.catalog` do `defineComponent`. */
export interface CatalogCase {
  readonly name: string;
  readonly props: Readonly<Record<string, unknown>>;
}

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

export const createDs = (input: DsInput): Ds => {
  const metas = input.components.map(metaOfComponent);
  const guide = input.guide === undefined || typeof input.guide === 'string' ? input.guide : guideOf(input.name, input.guide);
  const manifest = defineDs({
    name: input.name,
    version: input.version,
    components: metas.map((meta) => ({ ...meta, ds: meta.ds ?? input.name })),
    rules: input.rules ?? [],
    ...(input.theme === undefined ? {} : { theme: input.theme }),
    ...(guide === undefined ? {} : { guide }),
    ...(input.schema === undefined ? {} : { schema: input.schema }),
    ...(input.examples === undefined ? {} : { examples: input.examples }),
  });
  return Object.freeze({ ...manifest, implementations: input.components, warnings: input.theme === undefined ? [] : checkTheme(input.theme) });
};

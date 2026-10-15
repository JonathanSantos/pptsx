import type { ComponentMeta, Theme } from './core/types.ts';
import type { LintRule } from './lint/rule.ts';

/**
 * M17: o contrato do que um design system entrega ao núcleo. O núcleo só lê: as regras vão para o
 * `pptsx lint`, o guia e o schema para o MCP (`guide`/`schema` com `source`), o tema pode virar o da
 * config. Montar o manifesto (concatenar guias, gerar schema) é trabalho do `@pptsx/ds-kit`.
 */
export interface DsManifest {
  readonly name: string;
  readonly version: string;
  readonly components: readonly ComponentMeta[];
  readonly theme?: Theme;
  readonly rules: readonly LintRule[];
  /** Markdown com `##`/`###` (o `guide` do MCP navega por seção). */
  readonly guide?: string;
  /** Props por componente, no formato do `schema` do núcleo. */
  readonly schema?: Readonly<Record<string, unknown>>;
  /** Decks de exemplo (caminhos), para quem quer ver o DS em uso. */
  readonly examples?: readonly string[];
}

/** Identidade tipada (como `defineConfig`), com as checagens que valem para qualquer DS. */
export const defineDs = (manifest: DsManifest): DsManifest => {
  if (typeof manifest.name !== 'string' || manifest.name.trim() === '') throw new Error('defineDs: o DS precisa de name');
  const ids = manifest.rules.map((rule) => rule.id);
  const repeated = ids.find((id, index) => ids.indexOf(id) !== index);
  if (repeated !== undefined) throw new Error(`defineDs("${manifest.name}"): regra "${repeated}" repetida`);
  return Object.freeze({ ...manifest });
};

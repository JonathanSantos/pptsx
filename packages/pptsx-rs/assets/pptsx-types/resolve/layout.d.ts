import type { Children, DeckSection, LayoutDefinition, PlaceholderName, ResolvedLayout, ResolvedNode, ResolvedNotes } from '../core/types.ts';
/**
 * M15: o que o arquivo carrega além dos objetos do slide — layout (`defineLayout`) com placeholders e
 * conteúdo fixo, notas com estilo, seções. Validação no resolve, como o resto da estrutura.
 */
/** Nome do invólucro do conteúdo fixo: o path fica `Slide > Fixed > …`. */
export declare const FIXED_SEGMENT = "Fixed";
/** Filhos do slide com o conteúdo fixo do layout no fim (os índices dos irmãos do autor não mudam). */
export declare const withFixed: (children: Children, layout: LayoutDefinition | undefined) => Children;
export declare const resolvedLayoutOf: (layout: LayoutDefinition, slidePath: string) => ResolvedLayout;
/** Nós marcados com `placeholder` precisam de um layout que declare o nome, uma vez por slide. */
export declare const assertPlaceholders: (children: readonly ResolvedNode[], layout: ResolvedLayout | undefined) => void;
/** Placeholders do layout que nenhum nó do slide marca. */
export declare const unusedPlaceholdersOf: (children: readonly ResolvedNode[], layout: ResolvedLayout) => readonly PlaceholderName[];
export declare const placeholderTypeOf: (name: PlaceholderName) => string;
export declare const notesOf: (notes: unknown, path: string) => ResolvedNotes | undefined;
/** Seções em ordem estrita de `from`, cada uma num slide que existe; título não vazio. */
export declare const sectionsOf: (sections: unknown, slideCount: number) => readonly DeckSection[] | undefined;
/** Dois layouts diferentes com o mesmo nome dariam dois masters indistinguíveis no PowerPoint. */
export declare const assertUniqueLayoutNames: (layouts: readonly (readonly [LayoutDefinition, string])[]) => void;

import type { ResolvedSlide, TextProps } from '../core/types.ts';
/** O que o ajuste pode mudar num Text da árvore resolvida (numa Table, só `size`). */
export type TextPatch = Readonly<Pick<TextProps, 'size' | 'maxLines'>>;
export type TextPatches = ReadonlyMap<string, TextPatch>;
/** Cópia da árvore resolvida com os patches aplicados por path (a original não muda). */
export declare const patchTexts: (slide: ResolvedSlide, patches: TextPatches) => ResolvedSlide;

import type * as Pptx from './pptx.ts';

/**
 * M13: `href` já traduzido pelo fit (`slide:N` = slide de saída) → hyperlink do pptxgenjs.
 * Link interno vira `ppaction://hlinksldjump`; URL vira relacionamento externo.
 */

type Hyperlink = NonNullable<Pptx.ShapeProps['hyperlink']>;

const SLIDE = /^slide:(\d+)$/;

export const hyperlinkOf = (href: string | undefined): { readonly hyperlink?: Hyperlink } => {
  if (href === undefined) return {};
  const match = SLIDE.exec(href);
  return { hyperlink: match === null ? { url: href } : { slide: Number(match[1]) } };
};

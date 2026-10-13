import { PptxGenJS, type Presentation } from './pptx.ts';
import type { PositionedDeck, PositionedSlide } from '../core/types.ts';
import { ptToInches } from '../sizes.ts';
import { emitDebugOutlines, emitNode, type EmitContext } from './emitters.ts';
import { backgroundOf } from './options.ts';

export interface EmitOptions {
  readonly debug?: boolean;
  readonly baseDir: string;
}

const emitSlide = (pptx: Presentation, slide: PositionedSlide, options: EmitOptions): void => {
  const target = pptx.addSlide();
  const ctx: EmitContext = { baseDir: options.baseDir };
  const background = backgroundOf(slide, options.baseDir);
  if (background) target.background = background;
  slide.children.forEach((node) => emitNode(target, node, ctx));
  // Contornos depois de tudo para ficarem por cima do conteúdo.
  if (options.debug) emitDebugOutlines(target, slide.children);
  if (slide.props.notes) target.addNotes(slide.props.notes);
};

export const emitPptx = async (deck: PositionedDeck, options: EmitOptions): Promise<Buffer> => {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: deck.size.name, width: ptToInches(deck.size.width), height: ptToInches(deck.size.height) });
  pptx.layout = deck.size.name;
  deck.slides.forEach((slide) => emitSlide(pptx, slide, options));
  const output = await pptx.write({ outputType: 'nodebuffer' });
  return output as Buffer;
};

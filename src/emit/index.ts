import { PptxGenJS, type Presentation } from './pptx.ts';
import { DEFAULTS } from '../core/defaults.ts';
import type { LineBreaks, PositionedDeck, PositionedSlide } from '../core/types.ts';
import { ptToInches } from '../sizes.ts';
import type { LineSpacingStrategy } from './calibration.ts';
import { emitDebugOutlines, emitNode, type EmitContext } from './emitters.ts';
import { backgroundOf } from './options.ts';
import { sanitizePptx } from './sanitize.ts';

export interface EmitOptions {
  readonly debug?: boolean;
  readonly baseDir: string;
  /** Sobrescreve ACTIVE_LINE_SPACING (ex.: o script de calibração gera as duas variantes). */
  readonly lineSpacing?: LineSpacingStrategy;
  /** Idioma dos textos; padrão DEFAULTS.lang. */
  readonly lang?: string;
  /** 'forced' (padrão DEFAULTS.lineBreaks) ou 'auto'; ver runsOf em options.ts. */
  readonly lineBreaks?: LineBreaks;
}

const emitSlide = (pptx: Presentation, slide: PositionedSlide, options: EmitOptions): void => {
  const target = pptx.addSlide();
  const ctx: EmitContext = {
    baseDir: options.baseDir,
    lineSpacing: options.lineSpacing,
    lang: options.lang,
    lineBreaks: options.lineBreaks ?? DEFAULTS.lineBreaks,
  };
  const background = backgroundOf(slide, options.baseDir);
  if (background) target.background = background;
  slide.children.forEach((node) => emitNode(target, node, ctx));
  // Contornos depois de tudo para ficarem por cima do conteúdo.
  if (options.debug) emitDebugOutlines(target, slide.children);
  if (slide.props.notes) target.addNotes(slide.props.notes);
};

export { ACTIVE_LINE_SPACING, LINE_SPACING_CALIBRATION, type LineSpacingStrategy } from './calibration.ts';

export const emitPptx = async (deck: PositionedDeck, options: EmitOptions): Promise<Buffer> => {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: deck.size.name, width: ptToInches(deck.size.width), height: ptToInches(deck.size.height) });
  pptx.layout = deck.size.name;
  deck.slides.forEach((slide) => emitSlide(pptx, slide, options));
  const output = await pptx.write({ outputType: 'nodebuffer' });
  return sanitizePptx(output as Buffer);
};

import { PptxGenJS, type Presentation } from './pptx.ts';
import { DEFAULTS } from '../core/defaults.ts';
import type { LineBreaks, PositionedDeck, PositionedSlide } from '../core/types.ts';
import { ptToInches } from '../sizes.ts';
import type { LineSpacingStrategy } from './calibration.ts';
import { emitConnector, emitDebugOutlines, emitItem, type EmitContext } from './emitters.ts';
import { backgroundOf } from './options.ts';
import { embedFonts, type EmbeddedFont } from './embed.ts';
import { paintOrderOf } from './paint.ts';
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
  /** M8: faces a embutir (EOT pronto, ver src/emit/embed.ts); ausente ou vazio = sem embed. */
  readonly embedFonts?: readonly EmbeddedFont[];
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
  // M11: ordem de pintura CSS (zIndex, camadas), não a ordem da árvore.
  const items = paintOrderOf(slide);
  items.forEach((item) => emitItem(target, item, ctx));
  (slide.connectors ?? []).forEach((connector) => emitConnector(target, connector, ctx));
  // Contornos depois de tudo para ficarem por cima do conteúdo.
  if (options.debug) emitDebugOutlines(target, items);
  // Árvore montada à mão (sem resolve) pode trazer só props.notes em texto.
  const notes = slide.notes?.content ?? (typeof slide.props.notes === 'string' ? slide.props.notes : undefined);
  if (notes) target.addNotes(notes);
};

export type { EmbeddedFont } from './embed.ts';
export { paintOrderOf, placementOf, type PaintItem, type Placement, type Rotation } from './paint.ts';
export { boxShapeOf, decorationOf, uniformBorderOf, type Decoration } from './decoration.ts';
export { ACTIVE_LINE_SPACING, LINE_SPACING_CALIBRATION, type LineSpacingStrategy } from './calibration.ts';

export const emitPptx = async (deck: PositionedDeck, options: EmitOptions): Promise<Buffer> => {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: deck.size.name, width: ptToInches(deck.size.width), height: ptToInches(deck.size.height) });
  pptx.layout = deck.size.name;
  deck.slides.forEach((slide) => emitSlide(pptx, slide, options));
  const output = await pptx.write({ outputType: 'nodebuffer' });
  const sanitized = await sanitizePptx(output as Buffer);
  return embedFonts(sanitized, options.embedFonts ?? []);
};

import { PptxGenJS, type Presentation } from './pptx.ts';
import type * as Pptx from './pptx.ts';
import { DEFAULTS } from '../core/defaults.ts';
import type { DocumentProperties, LineBreaks, PositionedDeck, PositionedSlide, ResolvedTheme } from '../core/types.ts';
import { ptToInches } from '../sizes.ts';
import type { LineSpacingStrategy } from './calibration.ts';
import { emitConnector, emitDebugOutlines, emitItem, type EmitContext } from './emitters.ts';
import { backgroundOf } from './options.ts';
import { embedFonts, type EmbeddedFont } from './embed.ts';
import { paintOrderOf } from './paint.ts';
import { sanitizePptx } from './sanitize.ts';
import { applyTheme } from './theme.ts';
import { applyKeywords, setDocumentProperties } from './document.ts';
import { applyRichNotes } from './notes.ts';
import { outputSectionsOf, sectionTitleAt } from './sections.ts';
import { applyLayouts, layoutPlansOf, slideMasterPropsOf, PLACEHOLDER_PREFIX, type LayoutPlan } from './layouts.ts';
import { resolveAssetPath } from '../core/assets.ts';
import type { PaintItem } from './paint.ts';

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
  /** M15: tema do arquivo (cores e fontes); ausente = arquivo como antes. */
  readonly theme?: ResolvedTheme;
  /** M15: título, autor, empresa, assunto e palavras-chave do arquivo. */
  readonly document?: DocumentProperties;
}

/** M15: Text/Image marcados com placeholder saem com o nome `ph:<nome>`, que o pós-processamento liga ao layout. */
const placeholderTarget = (slide: Pptx.Slide, item: PaintItem): Pptx.Slide => {
  const name = (item.node.props as { readonly placeholder?: string }).placeholder;
  if (name === undefined || (item.node.kind !== 'text' && item.node.kind !== 'image')) return slide;
  const objectName = PLACEHOLDER_PREFIX + name;
  return Object.assign(Object.create(slide) as Pptx.Slide, {
    addText: (text: Parameters<Pptx.Slide['addText']>[0], textOptions?: Pptx.TextPropsOptions) => slide.addText(text, { ...textOptions, objectName }),
    addImage: (imageOptions: Pptx.ImageProps) => slide.addImage({ ...imageOptions, objectName }),
  });
};

/** Alvo que conta as chamadas: cada add* do pptxgenjs = um elemento de desenho no spTree. */
const countingTarget = (slide: Pptx.Slide): { readonly target: Pptx.Slide; readonly count: () => number } => {
  const calls = { value: 0 };
  const counted = <A extends unknown[]>(add: (...args: A) => unknown) => (...args: A) => {
    calls.value += 1;
    return add.apply(slide, args);
  };
  const target = Object.assign(Object.create(slide) as Pptx.Slide, {
    addText: counted(slide.addText),
    addImage: counted(slide.addImage),
    addShape: counted(slide.addShape),
    addTable: counted(slide.addTable),
    addChart: counted(slide.addChart),
  });
  return { target, count: () => calls.value };
};

const isFixedItem = (slide: PositionedSlide) => (item: PaintItem): boolean => {
  const fixed = slide.layout?.fixedPath;
  return fixed !== undefined && (item.node.path === fixed || item.node.path.startsWith(`${fixed} > `));
};

interface SlideTarget {
  readonly sectionTitle?: string;
  /** M15: o slide é o 1º do layout: o conteúdo fixo sai por último, para ir ao master. */
  readonly firstOfLayout: boolean;
}

/** Emite o slide; devolve quantos elementos de conteúdo fixo saíram no fim (0 fora do 1º slide do layout). */
const emitSlide = (pptx: Presentation, slide: PositionedSlide, options: EmitOptions, place: SlideTarget): number => {
  const masterName = slide.layout?.name;
  const target = pptx.addSlide({
    ...(place.sectionTitle === undefined ? {} : { sectionTitle: place.sectionTitle }),
    ...(masterName === undefined ? {} : { masterName }),
  });
  if (slide.props.hidden === true) target.hidden = true;
  const ctx: EmitContext = {
    baseDir: options.baseDir,
    lineSpacing: options.lineSpacing,
    lang: options.lang,
    lineBreaks: options.lineBreaks ?? DEFAULTS.lineBreaks,
  };
  const background = backgroundOf(slide, options.baseDir);
  if (background) target.background = background;
  // M11: ordem de pintura CSS (zIndex, camadas), não a ordem da árvore.
  const painted = paintOrderOf(slide);
  const fixed = painted.filter(isFixedItem(slide));
  const items = painted.filter((item) => !fixed.includes(item));
  items.forEach((item) => emitItem(placeholderTarget(target, item), item, ctx));
  (slide.connectors ?? []).forEach((connector) => emitConnector(target, connector, ctx));
  // Contornos depois de tudo para ficarem por cima do conteúdo.
  if (options.debug) emitDebugOutlines(target, items);
  // Árvore montada à mão (sem resolve) pode trazer só props.notes em texto.
  const notes = slide.notes?.content ?? (typeof slide.props.notes === 'string' ? slide.props.notes : undefined);
  if (notes) target.addNotes(notes);
  if (!place.firstOfLayout || fixed.length === 0) return 0;
  // M15: o conteúdo fixo vai por último para ser movido ao layout (os N últimos elementos do slide).
  const counting = countingTarget(target);
  fixed.forEach((item) => emitItem(counting.target, item, ctx));
  return counting.count();
};

export type { EmbeddedFont } from './embed.ts';
export { outputSectionsOf, type OutputSection } from './sections.ts';
export { paintOrderOf, placementOf, type PaintItem, type Placement, type Rotation } from './paint.ts';
export { boxShapeOf, decorationOf, uniformBorderOf, type Decoration } from './decoration.ts';
export { ACTIVE_LINE_SPACING, LINE_SPACING_CALIBRATION, type LineSpacingStrategy } from './calibration.ts';

const isFirstOfLayout = (plans: readonly LayoutPlan[], index: number): boolean => plans.some((plan) => plan.first === index);

export const emitPptx = async (deck: PositionedDeck, options: EmitOptions): Promise<Buffer> => {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: deck.size.name, width: ptToInches(deck.size.width), height: ptToInches(deck.size.height) });
  pptx.layout = deck.size.name;
  if (options.document !== undefined) setDocumentProperties(pptx, options.document);
  const plans = layoutPlansOf(deck);
  plans.forEach((plan) => pptx.defineSlideMaster(slideMasterPropsOf(plan, options.baseDir, resolveAssetPath)));
  const sections = outputSectionsOf(deck);
  sections.forEach((section) => pptx.addSection({ title: section.title }));
  const fixedCounts = new Map(
    deck.slides.map((slide, index) => [
      index,
      emitSlide(pptx, slide, options, { sectionTitle: sectionTitleAt(sections, index), firstOfLayout: isFirstOfLayout(plans, index) }),
    ]),
  );
  const output = await pptx.write({ outputType: 'nodebuffer' });
  const sanitized = await sanitizePptx(output as Buffer);
  const laidOut = await applyLayouts(sanitized, plans, fixedCounts, options.lang ?? DEFAULTS.lang);
  const notes = await applyRichNotes(laidOut, deck.slides.map((slide) => slide.notes), options.lang ?? DEFAULTS.lang);
  const described = await applyKeywords(notes, options.document);
  return applyTheme(await embedFonts(described, options.embedFonts ?? []), options.theme);
};

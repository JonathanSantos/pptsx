import Yoga, { Direction } from 'yoga-layout';
import type { Rect, SlideSize } from '../../../src/core/types.ts';
import type { LayoutEnv, PositionedDeck, PositionedSlide, ResolvedDeck, ResolvedSlide } from '../types.ts';
import { applyStyle } from './apply.ts';
import { settleBaselineRows } from './baseline.ts';
import { boxOf, readChildren } from './read.ts';
import { toContainerStyle } from './style.ts';
import { buildChildren, parentLayoutOf } from './tree.ts';

/**
 * Layout da PoC: Yoga com os padrões do CSS (`useWebDefaults(true)`: row, align-content
 * stretch, shrink 1), box model completo e o mesmo contrato da engine (frames absolutos).
 */
const createConfig = () => {
  const config = Yoga.Config.create();
  // Sem arredondar para pixel: a unidade é pt e queremos frações exatas.
  config.setPointScaleFactor(0);
  config.setUseWebDefaults(true);
  return config;
};

export const layoutSlide = (slide: ResolvedSlide, size: SlideSize, env: LayoutEnv): PositionedSlide => {
  const config = createConfig();
  const root = Yoga.Node.create(config);
  try {
    applyStyle(root, { ...toContainerStyle(slide.css), width: size.width, height: size.height });
    const parent = parentLayoutOf(slide.css, false);
    const children = buildChildren(slide.children, root, { config, env, parent }, slide.css);
    root.calculateLayout(size.width, size.height, Direction.LTR);
    settleBaselineRows(root, children, parent.direction, size);
    const frame: Rect = { x: 0, y: 0, width: size.width, height: size.height };
    return { ...slide, frame, box: boxOf(root), children: readChildren(children, frame, env) };
  } finally {
    root.freeRecursive();
    config.free();
  }
};

export const layoutDeck = (deck: ResolvedDeck, size: SlideSize, env: LayoutEnv): PositionedDeck => ({
  size,
  slides: deck.slides.map((slide) => layoutSlide(slide, size, env)),
});

export { measureInputOf } from './measure.ts';
export { contentRectOf } from './read.ts';

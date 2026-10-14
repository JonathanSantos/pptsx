import Yoga, { Direction } from 'yoga-layout';
import type { LayoutEnv, PositionedDeck, PositionedSlide, Rect, ResolvedDeck, ResolvedSlide, SlideSize } from '../core/types.ts';
import { applyStyle } from './apply.ts';
import { createConfig } from './config.ts';
import { settleBaselineRows } from './baseline.ts';
import { layoutGridChildren } from './grid-layout.ts';
import { boxOf, readChildren } from './read.ts';
import { toContainerStyle } from './style.ts';
import { buildChildren, parentLayoutOf } from './tree.ts';

/**
 * Layout: Yoga com os padrões do CSS (`useWebDefaults(true)`: row, align-content stretch,
 * shrink 1), box model completo, grid próprio (grid.ts) e frames absolutos no slide.
 */

export const layoutSlide = (slide: ResolvedSlide, size: SlideSize, env: LayoutEnv): PositionedSlide => {
  const config = createConfig();
  const root = Yoga.Node.create(config);
  try {
    applyStyle(root, { ...toContainerStyle(slide.css), width: size.width, height: size.height });
    const frame: Rect = { x: 0, y: 0, width: size.width, height: size.height };
    // Slide em grid: o Yoga só resolve a caixa do slide; a grade posiciona os filhos.
    if (slide.css.display === 'grid') {
      root.calculateLayout(size.width, size.height, Direction.LTR);
      const box = boxOf(root);
      return { ...slide, frame, box, children: layoutGridChildren(slide, frame, box, env) };
    }
    const parent = parentLayoutOf(slide.css, false);
    const children = buildChildren(slide.children, root, { config, env, parent }, slide.css);
    root.calculateLayout(size.width, size.height, Direction.LTR);
    settleBaselineRows(root, children, parent.direction, size);
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
export { columnWidthsOf, measureTable, type TableLayout } from './table.ts';
export {
  areaRect,
  offsetsOf,
  parseAutoTracks,
  parseTrackList,
  placeItems,
  sizeTracks,
  totalOf,
  tracksFor,
  type Area,
  type Breadth,
  type Contribution,
  type PlacementInput,
  type Placed,
  type SizingItem,
  type TrackSize,
} from './grid.ts';
export { gridModelOf, type GridContainer, type GridModel } from './grid-layout.ts';

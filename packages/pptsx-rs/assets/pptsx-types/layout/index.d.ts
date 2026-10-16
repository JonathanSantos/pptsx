import type { LayoutEnv, PositionedDeck, PositionedSlide, ResolvedDeck, ResolvedSlide, SlideSize } from '../core/types.ts';
/**
 * Layout: Yoga com os padrões do CSS (`useWebDefaults(true)`: row, align-content stretch,
 * shrink 1), box model completo, grid próprio (grid.ts) e frames absolutos no slide.
 */
export declare const layoutSlide: (resolved: ResolvedSlide, size: SlideSize, env: LayoutEnv) => PositionedSlide;
export declare const layoutDeck: (deck: ResolvedDeck, size: SlideSize, env: LayoutEnv) => PositionedDeck;
export { measureInputOf } from './measure.ts';
export { contentRectOf } from './read.ts';
export { columnWidthsOf, measureTable, type TableLayout } from './table.ts';
export { areaRect, offsetsOf, parseAutoTracks, parseTrackList, placeItems, sizeTracks, totalOf, tracksFor, type Area, type Breadth, type Contribution, type PlacementInput, type Placed, type SizingItem, type TrackSize, } from './grid.ts';
export { gridModelOf, type GridContainer, type GridModel } from './grid-layout.ts';

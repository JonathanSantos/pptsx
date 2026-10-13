import type {
  LayoutEnv,
  PositionedDeck,
  PositionedSlide,
  Rect,
  ResolvedDeck,
  ResolvedSlide,
  SlideSize,
} from '../core/types.ts';
import { layoutChildren } from './nodes.ts';
import { parentAreaOf } from './placement.ts';

export const layoutSlide = (slide: ResolvedSlide, size: SlideSize, env: LayoutEnv): PositionedSlide => {
  const frame: Rect = { x: 0, y: 0, width: size.width, height: size.height };
  return { ...slide, frame, children: layoutChildren(slide.children, parentAreaOf(frame, slide.props.padding), env) };
};

export const layoutDeck = (deck: ResolvedDeck, size: SlideSize, env: LayoutEnv): PositionedDeck => ({
  size,
  slides: deck.slides.map((slide) => layoutSlide(slide, size, env)),
});

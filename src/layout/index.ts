import Yoga, { Direction } from 'yoga-layout';
import { containerOf } from '../core/defaults.ts';
import type {
  LayoutEnv,
  PositionedDeck,
  PositionedSlide,
  Rect,
  ResolvedDeck,
  ResolvedSlide,
  SlideSize,
} from '../core/types.ts';
import { applyStyle } from './apply.ts';
import { readChildren } from './read.ts';
import { toContainerStyle } from './style.ts';
import { buildChildren } from './tree.ts';

const createConfig = () => {
  const config = Yoga.Config.create();
  // Sem arredondar para pixel: a unidade é pt e queremos frações exatas.
  config.setPointScaleFactor(0);
  config.setUseWebDefaults(false);
  return config;
};

export const layoutSlide = (slide: ResolvedSlide, size: SlideSize, env: LayoutEnv): PositionedSlide => {
  const config = createConfig();
  const root = Yoga.Node.create(config);
  try {
    applyStyle(root, { ...toContainerStyle(slide.props), width: size.width, height: size.height });
    const children = buildChildren(slide.children, root, {
      config,
      env,
      parentDirection: containerOf(slide.props).direction,
    });
    root.calculateLayout(size.width, size.height, Direction.LTR);
    const frame: Rect = { x: 0, y: 0, width: size.width, height: size.height };
    return { ...slide, frame, children: readChildren(children, frame, env) };
  } finally {
    root.freeRecursive();
    config.free();
  }
};

export const layoutDeck = (deck: ResolvedDeck, size: SlideSize, env: LayoutEnv): PositionedDeck => ({
  size,
  slides: deck.slides.map((slide) => layoutSlide(slide, size, env)),
});

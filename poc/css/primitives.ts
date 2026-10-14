import * as Engine from '../../src/primitives/index.ts';
import type { SlideElement } from '../../src/core/types.ts';
import type {
  CssBoxPropsAuthor,
  CssChartPropsAuthor,
  CssImagePropsAuthor,
  CssShapePropsAuthor,
  CssSlideProps,
  CssSpanProps,
  CssTablePropsAuthor,
  CssTextPropsAuthor,
} from './css-props.ts';

/**
 * As primitivas da engine, com a tipagem de props da PoC (CSS em camelCase). São as mesmas
 * funções marcadas (mesmo kind): o resolve da PoC e o da engine as reconhecem igual.
 */
type Typed<P> = (props: P) => SlideElement;

export const Deck = Engine.Deck;
export const Slide = Engine.Slide as unknown as Typed<CssSlideProps>;
export const Box = Engine.Box as unknown as Typed<CssBoxPropsAuthor>;
export const Text = Engine.Text as unknown as Typed<CssTextPropsAuthor>;
export const Image = Engine.Image as unknown as Typed<CssImagePropsAuthor>;
export const Shape = Engine.Shape as unknown as Typed<CssShapePropsAuthor>;
export const Chart = Engine.Chart as unknown as Typed<CssChartPropsAuthor>;
export const Table = Engine.Table as unknown as Typed<CssTablePropsAuthor>;
export const Span = Engine.Span as unknown as Typed<CssSpanProps>;
export const B = Engine.B;
export const I = Engine.I;

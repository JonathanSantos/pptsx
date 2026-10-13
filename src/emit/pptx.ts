import pptxgenjs from 'pptxgenjs';
import type * as PptxTypes from 'pptxgenjs';

/**
 * Adaptador do pptxgenjs. Os .d.ts do pacote são CJS (`export default` + namespace),
 * então sob NodeNext o TS vê o default import como o módulo inteiro; em runtime ESM
 * o default já é a classe. Resolvemos os dois casos aqui e reexportamos os tipos,
 * para o resto do emissor não depender dessa esquisitice.
 */
type PptxConstructor = typeof pptxgenjs.default;

const constructorOf = (mod: unknown): PptxConstructor => {
  const nested = (mod as { readonly default?: PptxConstructor }).default;
  return nested ?? (mod as PptxConstructor);
};

export const PptxGenJS: PptxConstructor = constructorOf(pptxgenjs);

export type Presentation = InstanceType<PptxConstructor>;
export type Slide = PptxTypes.default.Slide;
export type ShapeName = PptxTypes.default.SHAPE_NAME;
export type ShapeProps = PptxTypes.default.ShapeProps;
export type ShapeFillProps = PptxTypes.default.ShapeFillProps;
export type ShapeLineProps = PptxTypes.default.ShapeLineProps;
export type TextProps = PptxTypes.default.TextProps;
export type TextPropsOptions = PptxTypes.default.TextPropsOptions;
export type ImageProps = PptxTypes.default.ImageProps;
export type BackgroundProps = PptxTypes.default.BackgroundProps;

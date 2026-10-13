import type { DeckDefinition } from './core/types.ts';

export { Deck, Slide, Box, Text, Image, Shape } from './primitives/index.ts';
export { Fragment } from './jsx/jsx-runtime.ts';
export { resolveDeck, ResolveError } from './resolve/index.ts';
export { render } from './render.ts';

/** Identidade tipada: só existe para o arquivo do deck ganhar inferência de ctx. */
export const defineDeck = (fn: DeckDefinition): DeckDefinition => fn;

export type {
  Align,
  BoxProps,
  Child,
  Children,
  Color,
  Component,
  ContainerProps,
  DeckContext,
  DeckDefinition,
  DeckProps,
  Diagnostic,
  DiagnosticCode,
  FitPolicy,
  FlexDirection,
  FlexItemProps,
  FontFace,
  FontWeight,
  ImageFit,
  ImageProps,
  Justify,
  Length,
  PreviewOptions,
  Pt,
  RenderOptions,
  RenderResult,
  Severity,
  ShapeKind,
  ShapeProps,
  SizePresetName,
  SizeSpec,
  SlideElement,
  SlideProps,
  SlideSize,
  Spacing,
  StrokeProps,
  TextAlign,
  TextChildren,
  TextProps,
  TextStyleProps,
} from './core/types.ts';

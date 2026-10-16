import type { DeckDefinition } from './core/types.ts';

export { Deck, Slide, Box, Text, Image, Shape, Span, B, I, Sup, Sub, Chart, Table, Path, Icon, Connector, SlideNumber, Container, defineLayout, defineComponent } from './primitives/index.ts';
export { Fragment } from './jsx/jsx-runtime.ts';
export { resolveDeck, ResolveError } from './resolve/index.ts';
export { render, renderFragment, fragmentSlide, type FragmentOptions, type FragmentResult, type FragmentSlideOptions } from './render.ts';
export { defineDs, type DsManifest } from './ds.ts';
export type { LintContext, LintRule, RuleFinding } from './lint/rule.ts';
export { lintDeck, type LintFinding, type LintCode, type LintOptions } from './lint/lint.ts';
export { COMPONENT_META } from './core/types.ts';
// M17: utilitários genéricos para quem constrói em cima (design systems); nada de marca.
export { isResponsive, mapResponsive, pickResponsive } from './core/responsive.ts';
export { resolveTheme } from './resolve/index.ts';
export { toHexColor } from './resolve/colors.ts';
export { buildOverview, type OverviewItem } from './preview/overview.ts';
export { defaultFontFaces, defaultFontFiles } from './fonts/index.ts';
export { createContext, resolveSize } from './sizes.ts';
export { defineConfig } from './config.ts';
export type { PptsxConfig, TsxSlidesConfig } from './config.ts';
// M18-8: a skill para agentes (o `pptsx-ds skill` do kit monta a de um DS com isto).
export { createSkillFiles, skillNameOf, writeSkill, type CreateSkillOptions, type SkillDs, type SkillFile } from './skill/index.ts';

/** Identidade tipada: só existe para o arquivo do deck ganhar inferência de ctx. */
export const defineDeck = (fn: DeckDefinition): DeckDefinition => fn;

/** M11: props CSS do autor (camelCase) por primitiva. */
export type * from './core/css-props.ts';

// M17: a árvore resolvida e a posicionada (o que regras de lint e ferramentas de DS recebem).
export type {
  ResolvedNode,
  ResolvedSlide,
  ResolvedDeck,
  ResolvedText,
  ResolvedBox,
  ResolvedShape,
  ResolvedImage,
  ResolvedChart,
  ResolvedTable,
  PositionedNode,
  PositionedSlide,
  PositionedDeck,
  PositionedText,
  PositionedBox,
  CssStyle,
  Rect,
} from './core/types.ts';

export type {
  ContainerBox,
  ContainerBreakpoint,
  ContainerQueryProps,
  ContainerResponsive,
  ContainerResponsiveValue,
  Align,
  ArrowType,
  ConnectorLabelStyle,
  ConnectorProps,
  ConnectorRoute,
  ConnectorSide,
  IconProps,
  LineCap,
  LineJoin,
  LineStyle,
  PathCommand,
  PathProps,
  RunFace,
  SlideNumberFormat,
  SlideNumberProps,
  VerticalAlign,
  AuthorPropsMap,
  BoxProps,
  Breakpoint,
  ChartData,
  ChartKind,
  ChartProps,
  ChartSeries,
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
  LineRun,
  Justify,
  Length,
  PreviewOptions,
  Pt,
  RenderOptions,
  RenderResult,
  Responsive,
  ResponsiveProps,
  ResponsiveValue,
  Severity,
  ShapeKind,
  ShapeProps,
  SizePresetName,
  SizeSpec,
  SlideElement,
  SlideProps,
  SlideSize,
  Spacing,
  SpanProps,
  StrokeProps,
  TableCellContext,
  TableCellIcon,
  ComponentMeta,
  ComponentCatalogCase,
  ComponentMetaFor,
  DeckSection,
  DocumentProperties,
  LayoutComponent,
  LayoutDefinition,
  LayoutOptions,
  PlaceholderName,
  Theme,
  ThemeColorName,
  ThemeColors,
  ThemeFonts,
  TableCellSpec,
  TableCellValue,
  CellVerticalAlign,
  ChartAxis,
  ChartLabels,
  ChartLabelPosition,
  ChartLegendPosition,
  TableColumn,
  TableFitPolicy,
  TableHeaderStyle,
  TableProps,
  TextAlign,
  TextChildren,
  TextProps,
  TextRun,
  TextStyleProps,
} from './core/types.ts';

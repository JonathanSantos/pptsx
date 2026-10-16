import type { ArrowType, BoxProps, LineCap, LineStyle, ShapeKind, ShapeProps } from '../core/types.ts';
/** Validação das props de forma (M12-2): kinds curadas, setas só em linha, Box shape sem `line`. */
export declare const SHAPE_KINDS: readonly ShapeKind[];
export declare const ARROW_TYPES: readonly ArrowType[];
export declare const LINE_STYLES: readonly LineStyle[];
export declare const LINE_CAPS: readonly LineCap[];
/** Valor fora da lista → ResolveError com a lista válida. */
export declare const assertOneOf: <T extends string>(value: unknown, allowed: readonly T[], what: string, path: string) => void;
export declare const assertValidShape: (props: Omit<ShapeProps, 'children'>, path: string) => void;
export declare const assertBoxShape: (props: Omit<BoxProps, 'children'>, path: string) => void;

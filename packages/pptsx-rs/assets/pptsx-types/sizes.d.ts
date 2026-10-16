import type { DeckContext, Pt, SizePresetName, SizeSpec, SlideSize } from './core/types.ts';
export declare const PRESETS: Readonly<Record<SizePresetName, SlideSize>>;
export declare const inchesToPt: (inches: number) => Pt;
export declare const ptToInches: (pt: Pt) => number;
export declare const resolveSize: (spec: SizeSpec) => SlideSize;
export declare const createContext: (size: SlideSize) => DeckContext;
export declare const parseSizeList: (csv: string) => SizeSpec[];

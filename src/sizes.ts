import { DEFAULTS, PT_PER_INCH } from './core/defaults.ts';
import type { DeckContext, Pt, SizePresetName, SizeSpec, SlideSize } from './core/types.ts';

export const PRESETS: Readonly<Record<SizePresetName, SlideSize>> = Object.freeze({
  '16x9': { name: '16x9', width: 720, height: 405 },
  '16x10': { name: '16x10', width: 720, height: 450 },
  '4x3': { name: '4x3', width: 720, height: 540 },
  wide: { name: 'wide', width: 960, height: 540 },
});

const PRESET_NAMES = Object.keys(PRESETS) as readonly SizePresetName[];

export const inchesToPt = (inches: number): Pt => inches * PT_PER_INCH;

export const ptToInches = (pt: Pt): number => pt / PT_PER_INCH;

const isPresetName = (value: string): value is SizePresetName =>
  (PRESET_NAMES as readonly string[]).includes(value);

const unknownPresetError = (value: string): Error =>
  new Error(`Unknown slide size "${value}". Valid presets: ${PRESET_NAMES.join(', ')}; custom: "<w>x<h>in" (e.g. "10x7.5in").`);

// String(n) já descarta zeros desnecessários (7.50 → "7.5", 10.0 → "10").
const customName = (width: number, height: number): string => `custom-${width}x${height}`;

export const resolveSize = (spec: SizeSpec): SlideSize => {
  if (typeof spec !== 'string') {
    return { name: customName(spec.width, spec.height), width: inchesToPt(spec.width), height: inchesToPt(spec.height) };
  }
  if (!isPresetName(spec)) throw unknownPresetError(spec);
  return PRESETS[spec];
};

export const createContext = (size: SlideSize): DeckContext => ({
  name: size.name,
  width: size.width,
  height: size.height,
  aspect: size.width / size.height,
  scale: Math.min(size.width / DEFAULTS.referenceSize.width, size.height / DEFAULTS.referenceSize.height),
});

const CUSTOM_SIZE = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)in$/;

const parseSizeToken = (token: string): SizeSpec => {
  if (isPresetName(token)) return token;
  const match = CUSTOM_SIZE.exec(token);
  if (!match) throw unknownPresetError(token);
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width <= 0 || height <= 0) throw unknownPresetError(token);
  return { width, height };
};

export const parseSizeList = (csv: string): SizeSpec[] =>
  csv
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .map(parseSizeToken);

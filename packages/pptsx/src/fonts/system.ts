import { readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { extname, join } from 'node:path';
import * as fontkit from 'fontkit';
import { weightValueOf } from '../core/defaults.ts';
import type { FontFace, FontWeight } from '../core/types.ts';

/** Face já com arquivo: é o que o registro, o preview e o embed consomem. */
export type FileFontFace = FontFace & { readonly file: string };

export interface SystemFontEntry {
  /** Família normalizada (minúsculas, espaços colapsados). */
  readonly family: string;
  readonly bold: boolean;
  readonly italic: boolean;
  /** OS/2.usWeightClass; desempata faces do mesmo grupo (ex.: Medium vs Regular). */
  readonly weightClass: number;
  readonly file: string;
  /** Nome PostScript da face: seleciona a face certa dentro de uma coleção (.ttc). */
  readonly postscriptName?: string;
  /** Face de .ttc: o registro só carrega a 1ª face da coleção, então perde no desempate. */
  readonly collection: boolean;
}

export interface SystemFontIndex {
  readonly entries: readonly SystemFontEntry[];
}

export interface ResolvedFontFaces {
  readonly faces: readonly FileFontFace[];
  /** "Inter bold italic": família como o autor escreveu, peso e itálico. */
  readonly missing: readonly string[];
}

const FONT_EXTENSIONS: ReadonlySet<string> = new Set(['.ttf', '.otf', '.ttc']);
const BOLD_WEIGHT_CLASS = 600;
const TARGET_WEIGHT_CLASS = { regular: 400, bold: 700 } as const;
/** Meio passo de peso: 'Inter Medium' (500) não responde por 600. */
const NUMERIC_WEIGHT_SLACK = 50;

export const normalizeFamily = (family: string): string => family.trim().toLowerCase().replace(/\s+/g, ' ');

export const fontLabelOf = (face: Pick<FontFace, 'family' | 'weight' | 'italic'>): string =>
  [face.family, face.weight, ...(face.italic ? ['italic'] : [])].join(' ');

/** Pastas de fontes por plataforma; parâmetros injetáveis para teste. */
export const defaultFontDirs = (
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  home: string = homedir(),
): readonly string[] => {
  if (platform === 'darwin') {
    return ['/System/Library/Fonts', '/System/Library/Fonts/Supplemental', '/Library/Fonts', join(home, 'Library/Fonts')];
  }
  if (platform === 'win32') {
    return [
      ...(env.WINDIR ? [join(env.WINDIR, 'Fonts')] : []),
      ...(env.LOCALAPPDATA ? [join(env.LOCALAPPDATA, 'Microsoft', 'Windows', 'Fonts')] : []),
    ];
  }
  return ['/usr/share/fonts', '/usr/local/share/fonts', join(home, '.fonts'), join(home, '.local/share/fonts')];
};

// Pasta inexistente ou sem permissão não é erro: só não contribui com fontes.
const fontFilesIn = (dir: string): readonly string[] => {
  try {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return fontFilesIn(path);
      return FONT_EXTENSIONS.has(extname(entry.name).toLowerCase()) ? [path] : [];
    });
  } catch {
    return [];
  }
};

interface MacStyle {
  readonly bold?: boolean;
  readonly italic?: boolean;
}

// `head` existe no fontkit mas não nos tipos publicados.
const macStyleOf = (font: fontkit.Font): MacStyle =>
  (font as fontkit.Font & { readonly head?: { readonly macStyle?: MacStyle } }).head?.macStyle ?? {};

// Família tipográfica (ID 16) agrupa pesos que a família "legada" (ID 1) separa: "Inter" vs "Inter Medium".
const familiesOf = (font: fontkit.Font): readonly string[] => {
  const names = [font.familyName, font.getName('preferredFamily', 'en')].filter(
    (name): name is string => typeof name === 'string' && name.trim() !== '',
  );
  return [...new Set(names.map(normalizeFamily))];
};

const entriesOfFace = (font: fontkit.Font, file: string, collection: boolean): readonly SystemFontEntry[] => {
  const os2 = font['OS/2'] as fontkit.Os2Table | undefined;
  const macStyle = macStyleOf(font);
  const weightClass = os2?.usWeightClass ?? (macStyle.bold ? TARGET_WEIGHT_CLASS.bold : TARGET_WEIGHT_CLASS.regular);
  const bold = weightClass >= BOLD_WEIGHT_CLASS;
  const italic = (os2?.fsSelection.italic ?? false) || (macStyle.italic ?? false);
  const postscriptName = font.postscriptName?.trim() || undefined;
  return familiesOf(font).map((family) => ({
    family,
    bold,
    italic,
    weightClass,
    file,
    collection,
    ...(postscriptName ? { postscriptName } : {}),
  }));
};

// Arquivo que o fontkit não abre (ou face corrompida) é ignorado: uma fonte ruim não derruba o índice.
const entriesOfFile = (file: string): readonly SystemFontEntry[] => {
  try {
    const loaded = fontkit.openSync(file);
    const collection = 'fonts' in loaded && Array.isArray(loaded.fonts);
    const faces = 'fonts' in loaded ? loaded.fonts : [loaded];
    return faces.flatMap((font) => {
      try {
        return entriesOfFace(font, file, collection);
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
};

const indexCache = new Map<string, SystemFontIndex>();

/** Varre as pastas uma vez por processo (cache por lista de pastas): IO só aqui. */
export const createSystemFontIndex = (dirs: readonly string[] = defaultFontDirs()): SystemFontIndex => {
  const key = dirs.join('\0');
  const cached = indexCache.get(key);
  if (cached !== undefined) return cached;
  const files = [...new Set(dirs.flatMap(fontFilesIn))];
  const index: SystemFontIndex = { entries: files.flatMap(entriesOfFile) };
  indexCache.set(key, index);
  return index;
};

// Prefere arquivo avulso a coleção e, entre iguais, o peso mais perto do canônico (400/700).
const rankOf = (entry: SystemFontEntry, weight: FontWeight): number =>
  (entry.collection ? 10_000 : 0) + Math.abs(entry.weightClass - weightValueOf(weight));

export const findSystemFont = (
  index: SystemFontIndex,
  family: string,
  weight: FontWeight,
  italic: boolean,
): SystemFontEntry | undefined => {
  const wanted = normalizeFamily(family);
  const bold = weight === 'bold';
  // M13: peso numérico = a face daquele peso (usWeightClass a até meio passo); 'regular'/'bold' como antes.
  const sameWeight = (entry: SystemFontEntry): boolean =>
    typeof weight === 'number' ? Math.abs(entry.weightClass - weight) <= NUMERIC_WEIGHT_SLACK : entry.bold === bold;
  const candidates = index.entries.filter((entry) => entry.family === wanted && sameWeight(entry) && entry.italic === italic);
  return [...candidates].sort((a, b) => rankOf(a, weight) - rankOf(b, weight))[0];
};

type FaceResolution = { readonly face: FileFontFace } | { readonly missing: string };

const resolveFace = (face: FontFace, index: SystemFontIndex | undefined): FaceResolution => {
  if (face.file !== undefined) return { face: { ...face, file: face.file } };
  const found = index && findSystemFont(index, face.family, face.weight, face.italic ?? false);
  if (found === undefined) return { missing: fontLabelOf(face) };
  // O nome PostScript vai sempre: numa coleção é o que faz o registro e o preview abrirem a face certa.
  return { face: { ...face, file: found.file, ...(found.postscriptName ? { postscriptName: found.postscriptName } : {}) } };
};

/**
 * Completa `file` das faces pelo índice do sistema. Só varre as pastas se alguma face
 * não tiver arquivo; as não achadas saem em `missing` (o `font-missing` por nó vem do fit).
 */
export const resolveFontFaces = (faces: readonly FontFace[], index?: SystemFontIndex): ResolvedFontFaces => {
  const needsSystem = faces.some((face) => face.file === undefined);
  const systemIndex = needsSystem ? (index ?? createSystemFontIndex()) : undefined;
  const resolutions = faces.map((face) => resolveFace(face, systemIndex));
  return {
    faces: resolutions.flatMap((r) => ('face' in r ? [r.face] : [])),
    missing: resolutions.flatMap((r) => ('missing' in r ? [r.missing] : [])),
  };
};

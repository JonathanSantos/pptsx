import * as fontkit from 'fontkit';
import { DEFAULTS, weightValueOf } from '../core/defaults.ts';
import type { FontFace, FontWeight } from '../core/types.ts';

export interface FaceMatch {
  readonly font: fontkit.Font;
  /** Peso numérico da face registrada. */
  readonly weight: number;
  readonly italic: boolean;
}

export interface FontRegistry {
  readonly faces: readonly FontFace[];
  /** Face escolhida pela correspondência do CSS (itálico, depois peso); undefined = família sem face. */
  readonly get: (family: string, weight: FontWeight, italic: boolean) => fontkit.Font | undefined;
  /** M13: a mesma escolha, com o peso e o itálico da face usada. */
  readonly match: (family: string, weight: FontWeight, italic: boolean) => FaceMatch | undefined;
}

// Família comparada sem caixa e sem espaços nas pontas: 'arial' e 'Arial ' são a mesma face.
const familyKeyOf = (family: string): string => family.trim().toLowerCase();

const isCollection = (loaded: fontkit.Font | fontkit.FontCollection): loaded is fontkit.FontCollection =>
  'fonts' in loaded && Array.isArray(loaded.fonts);

/**
 * Escolhe a face dentro do arquivo carregado. Coleção (.ttc/.dfont, como as fontes do
 * macOS): a face de `postscriptName`, ou a 1ª sem ele. Arquivo de face única: ela mesma.
 * Não se usa `openSync(file, postscriptName)` direto porque, num .ttf comum, o fontkit
 * trata o nome como instância de fonte variável e lança erro.
 */
const faceOf = (loaded: fontkit.Font | fontkit.FontCollection, file: string, postscriptName?: string): fontkit.Font => {
  if (!isCollection(loaded)) return loaded;
  if (postscriptName === undefined) {
    const [first] = loaded.fonts;
    if (first === undefined) throw new Error(`Coleção de fontes vazia: ${file}`);
    return first;
  }
  const named = loaded.getFont(postscriptName);
  if (named === null) throw new Error(`Face "${postscriptName}" não existe na coleção ${file}`);
  return named;
};

/** Chave do cache de faces carregadas: o mesmo arquivo pode ter várias faces (coleção). */
const fontKeyOf = (file: string, postscriptName?: string): string => `${file}#${postscriptName ?? ''}`;

interface FaceSource {
  readonly file: string;
  readonly postscriptName?: string;
}

const describe = (face: FontFace): string =>
  [face.family, face.weight, ...(face.italic === true ? ['italic'] : [])].join(' ');

// Achar a face no sistema é do módulo src/fonts (resolveFontFaces); aqui só se carrega arquivo.
const sourceOf = (face: FontFace): FaceSource => {
  if (face.file === undefined) {
    throw new Error(`FontFace sem file: resolva com resolveFontFaces antes (${describe(face)})`);
  }
  return face.postscriptName === undefined ? { file: face.file } : { file: face.file, postscriptName: face.postscriptName };
};

/** Cada arquivo é aberto uma vez; cada face (arquivo + postscriptName) é extraída uma vez. */
const loadFaces = (sources: readonly FaceSource[]): ReadonlyMap<string, fontkit.Font> => {
  const files = [...new Set(sources.map((source) => source.file))];
  const loadedByFile = new Map(files.map((file) => [file, fontkit.openSync(file)]));
  const unique = new Map(sources.map((source) => [fontKeyOf(source.file, source.postscriptName), source]));
  return new Map(
    [...unique].map(([key, { file, postscriptName }]) => {
      const loaded = loadedByFile.get(file);
      if (loaded === undefined) throw new Error(`Fonte não carregada: ${file}`);
      return [key, faceOf(loaded, file, postscriptName)];
    }),
  );
};

interface Entry {
  readonly weight: number;
  readonly italic: boolean;
  readonly font: fontkit.Font;
}

const NORMAL = DEFAULTS.text.weights.regular;
/** CSS Fonts §5.2: 500 é o limite de cima da faixa "normal" (400 tenta 500 antes de descer). */
const MEDIUM = 500;

const below = (weights: readonly number[], limit: number): readonly number[] => weights.filter((w) => w < limit).sort((a, b) => b - a);
const above = (weights: readonly number[], limit: number): readonly number[] => weights.filter((w) => w > limit).sort((a, b) => a - b);

/**
 * Ordem de preferência dos pesos disponíveis para um pedido (CSS Fonts §5.2, font-weight):
 * 400–500: o pedido, depois o resto da faixa até 500, depois abaixo (descendo), depois acima;
 * < 400: o pedido e abaixo (descendo), depois acima (subindo); > 500: o pedido e acima, depois abaixo.
 */
export const weightPreference = (available: readonly number[], wanted: number): readonly number[] => {
  const unique = [...new Set(available)];
  const exact = unique.includes(wanted) ? [wanted] : [];
  if (wanted >= NORMAL && wanted <= MEDIUM) {
    const band = unique.filter((w) => w > wanted && w <= MEDIUM).sort((a, b) => a - b);
    return [...exact, ...band, ...below(unique, wanted), ...above(unique, MEDIUM)];
  }
  if (wanted < NORMAL) return [...exact, ...below(unique, wanted), ...above(unique, wanted)];
  return [...exact, ...above(unique, wanted), ...below(unique, wanted)];
};

const pickWeight = (entries: readonly Entry[], wanted: number): Entry | undefined => {
  const [best] = weightPreference(entries.map((entry) => entry.weight), wanted);
  return best === undefined ? undefined : entries.find((entry) => entry.weight === best);
};

/** Carrega cada arquivo uma única vez (IO na borda); `get`/`match` são só consulta em memória. */
export const createFontRegistry = (faces: readonly FontFace[]): FontRegistry => {
  const sources = faces.map(sourceOf);
  const fontByFace = loadFaces(sources);
  const byFamily = new Map<string, Entry[]>();
  faces.forEach((face, index) => {
    const source = sources[index]!;
    const font = fontByFace.get(fontKeyOf(source.file, source.postscriptName));
    if (font === undefined) return;
    const key = familyKeyOf(face.family);
    const entries = byFamily.get(key) ?? [];
    // A 1ª face registrada com o mesmo peso e itálico vence (como antes do M13).
    if (!entries.some((entry) => entry.weight === weightValueOf(face.weight) && entry.italic === (face.italic ?? false))) {
      byFamily.set(key, [...entries, { weight: weightValueOf(face.weight), italic: face.italic ?? false, font }]);
    }
  });

  const match = (family: string, weight: FontWeight, italic: boolean): FaceMatch | undefined => {
    const entries = byFamily.get(familyKeyOf(family)) ?? [];
    // Itálico ausente cai para as faces retas: mede-se igual o bastante e não é "fonte faltando".
    const styled = entries.filter((entry) => entry.italic === italic);
    const pool = styled.length > 0 ? styled : entries;
    const chosen = pickWeight(pool, weightValueOf(weight));
    return chosen === undefined ? undefined : { font: chosen.font, weight: chosen.weight, italic: chosen.italic };
  };

  return { faces, get: (family, weight, italic) => match(family, weight, italic)?.font, match };
};

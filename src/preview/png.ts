import { Resvg } from '@resvg/resvg-js';
import * as fontkit from 'fontkit';

export interface PngOptions {
  readonly widthPx: number;
  readonly fontFiles: readonly string[];
}

/** Coleções (.ttc) expõem as faces em `fonts`; usamos a primeira. */
const familyOfFile = (file: string): string => {
  const font = fontkit.openSync(file);
  return 'fonts' in font ? (font.fonts[0]?.familyName ?? '') : font.familyName;
};

/** Primeira família dos arquivos: resvg sem fontes do sistema não tem outro fallback. */
export const defaultFamilyOf = (fontFiles: readonly string[]): string | undefined => {
  const [first] = fontFiles;
  return first === undefined ? undefined : familyOfFile(first);
};

/**
 * Sem fontes do sistema o preview é determinístico: renderiza igual em
 * qualquer máquina, só com as fontes registradas no deck.
 */
export const rasterize = (svg: string, fontFiles: readonly string[], widthPx?: number): Buffer => {
  const resvg = new Resvg(svg, {
    fitTo: widthPx === undefined ? { mode: 'original' } : { mode: 'width', value: widthPx },
    font: {
      fontFiles: [...fontFiles],
      loadSystemFonts: false,
      defaultFontFamily: defaultFamilyOf(fontFiles),
    },
  });
  return resvg.render().asPng();
};

export const svgToPng = (svg: string, options: PngOptions): Buffer =>
  rasterize(svg, options.fontFiles, options.widthPx);

/** Utilidades de PNG para testes: gerar imagens pequenas e ler o cabeçalho. */
import { Resvg } from '@resvg/resvg-js';
import { fileURLToPath } from 'node:url';

export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const FONT_REGULAR = fileURLToPath(new URL('../../fonts/LiberationSans-Regular.ttf', import.meta.url));

export const isPng = (buffer: Buffer): boolean =>
  buffer.length > 24 && buffer.subarray(0, 8).equals(PNG_SIGNATURE) && buffer.toString('ascii', 12, 16) === 'IHDR';

/** Largura/altura lidas do chunk IHDR (logo após a assinatura). */
export const pngSize = (buffer: Buffer): { width: number; height: number } => {
  if (!isPng(buffer)) throw new Error('not a PNG');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
};

/** PNG sólido width×height gerado pelo resvg (sem fontes do sistema). */
export const makePng = (width = 4, height = 2, color = '#3366cc'): Buffer =>
  new Resvg(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${color}"/></svg>`,
    { font: { loadSystemFonts: false } },
  )
    .render()
    .asPng();

import { isAbsolute, resolve } from 'node:path';

/** src relativo é resolvido contra baseDir (padrão: cwd). */
export const resolveAssetPath = (baseDir: string, src: string): string =>
  isAbsolute(src) ? src : resolve(baseDir, src);

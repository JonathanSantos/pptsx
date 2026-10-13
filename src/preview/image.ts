import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { resolveAssetPath } from '../core/assets.ts';

export type ReadFile = (path: string) => Buffer;

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

const FALLBACK_MIME = 'application/octet-stream';

export const mimeOf = (path: string): string => MIME_BY_EXTENSION[extname(path).toLowerCase()] ?? FALLBACK_MIME;

export const dataUriOf = (mime: string, data: Buffer): string => `data:${mime};base64,${data.toString('base64')}`;

/** Única fronteira de IO do SVG; readFile injetável mantém slideToSvg testável. */
export const loadImageUri = (src: string, baseDir: string, readFile: ReadFile = readFileSync): string => {
  const path = resolveAssetPath(baseDir, src);
  return dataUriOf(mimeOf(path), readFile(path));
};

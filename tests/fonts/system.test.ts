import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FontFace } from '../../src/core/types.ts';
import { createSystemFontIndex, resolveFontFaces } from '../../src/fonts/index.ts';
import { createFontRegistry } from '../../src/text/index.ts';

/**
 * M8-D: resolver de fontes do sistema com diretórios injetados. Os arquivos são
 * cópias da Liberation Sans com nomes que não dizem nada: o índice tem que ler
 * família/peso/itálico de dentro da fonte (OS/2, head).
 */

const repoFont = (name: string): string => fileURLToPath(new URL(`../../fonts/LiberationSans-${name}.ttf`, import.meta.url));

let dir = '';
let files: { regular: string; bold: string; italic: string } = { regular: '', bold: '', italic: '' };

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'pptsx-fonts-'));
  mkdirSync(join(dir, 'sub'));
  files = { regular: join(dir, 'a1.ttf'), bold: join(dir, 'zz-qualquer.ttf'), italic: join(dir, 'sub', 'x.ttf') };
  copyFileSync(repoFont('Regular'), files.regular);
  copyFileSync(repoFont('Bold'), files.bold);
  copyFileSync(repoFont('Italic'), files.italic);
  writeFileSync(join(dir, 'quebrada.ttf'), Buffer.from('isto não é uma fonte'));
  writeFileSync(join(dir, 'leia-me.txt'), 'nada');
});

afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

const resolveIn = (faces: readonly FontFace[]) => resolveFontFaces(faces, createSystemFontIndex([dir]));

describe('resolveFontFaces — fake system directory', () => {
  it('finds the bold face by its content and reports the missing family', () => {
    const r = resolveIn([
      { family: 'Liberation Sans', weight: 'bold' },
      { family: 'Inter', weight: 'regular' },
    ]);
    expect(r.faces).toHaveLength(1);
    expect(r.faces[0]).toMatchObject({ family: 'Liberation Sans', weight: 'bold', file: files.bold });
    expect(r.missing).toEqual(['Inter regular']);
  });

  it('distinguishes regular, bold and italic', () => {
    const r = resolveIn([
      { family: 'Liberation Sans', weight: 'regular' },
      { family: 'Liberation Sans', weight: 'bold' },
      { family: 'Liberation Sans', weight: 'regular', italic: true },
    ]);
    expect(r.missing).toEqual([]);
    expect(r.faces.map((f) => f.file)).toEqual([files.regular, files.bold, files.italic]);
  });

  it('matches the family ignoring case and repeated spaces', () => {
    const r = resolveIn([{ family: 'liberation  SANS', weight: 'bold' }]);
    expect(r.missing).toEqual([]);
    expect(r.faces[0]?.file).toBe(files.bold);
  });

  it('keeps the family as the author wrote it (logical name)', () => {
    const r = resolveIn([{ family: 'liberation  SANS', weight: 'bold' }]);
    expect(r.faces[0]?.family).toBe('liberation  SANS');
  });

  it('a face without a file in the directory goes to missing (no fallback)', () => {
    const r = resolveIn([{ family: 'Liberation Sans', weight: 'bold', italic: true }]);
    expect(r.faces).toEqual([]);
    expect(r.missing).toEqual(['Liberation Sans bold italic']);
  });

  it('a face that already has a file passes through untouched', () => {
    const face: FontFace = { family: 'Marca', weight: 'regular', file: repoFont('Regular') };
    const r = resolveIn([face]);
    expect(r.faces).toEqual([face]);
    expect(r.missing).toEqual([]);
  });

  it('invalid font files and other extensions are ignored', () => {
    expect(() => createSystemFontIndex([dir])).not.toThrow();
    const r = resolveIn([{ family: 'Liberation Sans', weight: 'regular' }]);
    expect(r.faces[0]?.file).toBe(files.regular);
  });

  it('a directory that does not exist is ignored', () => {
    const r = resolveFontFaces(
      [{ family: 'Liberation Sans', weight: 'bold' }],
      createSystemFontIndex([join(dir, 'nao-existe'), dir]),
    );
    expect(r.faces[0]?.file).toBe(files.bold);
  });

  it('the resolved faces load in the registry', () => {
    const r = resolveIn([{ family: 'Liberation Sans', weight: 'bold' }]);
    const registry = createFontRegistry(r.faces);
    expect(registry.get('Liberation Sans', 'bold', false)).toBeDefined();
  });
});

// ───────────── coleções (.ttc) — depende do sistema ─────────────

const HELVETICA_TTC = '/System/Library/Fonts/Helvetica.ttc';

describe.skipIf(!existsSync(HELVETICA_TTC))('collections (.ttc)', () => {
  let ttcDir = '';
  beforeAll(() => {
    ttcDir = mkdtempSync(join(tmpdir(), 'pptsx-ttc-'));
    copyFileSync(HELVETICA_TTC, join(ttcDir, 'colecao.ttc'));
  });
  afterAll(() => {
    if (ttcDir) rmSync(ttcDir, { recursive: true, force: true });
  });

  it('indexes every face of the collection and fills postscriptName', () => {
    const r = resolveFontFaces(
      [
        { family: 'Helvetica', weight: 'regular' },
        { family: 'Helvetica', weight: 'bold' },
      ],
      createSystemFontIndex([ttcDir]),
    );
    expect(r.missing).toEqual([]);
    expect(r.faces.map((f) => f.file)).toEqual([join(ttcDir, 'colecao.ttc'), join(ttcDir, 'colecao.ttc')]);
    expect(r.faces[1]?.postscriptName).toBe('Helvetica-Bold');
    expect(r.faces[0]?.postscriptName).not.toBe(r.faces[1]?.postscriptName);
  });

  it('createFontRegistry opens the face named by postscriptName', () => {
    const registry = createFontRegistry([
      { family: 'Helvetica', weight: 'bold', file: HELVETICA_TTC, postscriptName: 'Helvetica-Bold' },
    ]);
    expect(registry.get('Helvetica', 'bold', false)?.postscriptName).toBe('Helvetica-Bold');
  });
});

describe.skipIf(process.platform !== 'darwin' || !existsSync(HELVETICA_TTC))('default system directories (macOS)', () => {
  it('finds Helvetica bold without file', () => {
    const r = resolveFontFaces([{ family: 'Helvetica', weight: 'bold' }]);
    expect(r.missing).toEqual([]);
    expect(r.faces[0]?.file).toBeDefined();
  }, 60_000);
});

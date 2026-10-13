import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { createFontRegistry } from '../../src/text/index.ts';
import type { FontFace } from '../../src/core/types.ts';

/**
 * Registro de fontes (M3): Liberation Sans registrada como 'Arial'.
 * As faces são identificadas pelo postscriptName lido pelo fontkit.
 */
const file = (name: string): string => fileURLToPath(new URL(`../../fonts/LiberationSans-${name}.ttf`, import.meta.url));

const ALL_FACES: readonly FontFace[] = [
  { family: 'Arial', weight: 'regular', file: file('Regular') },
  { family: 'Arial', weight: 'bold', file: file('Bold') },
  { family: 'Arial', weight: 'regular', italic: true, file: file('Italic') },
  { family: 'Arial', weight: 'bold', italic: true, file: file('BoldItalic') },
];

const UPRIGHT_FACES: readonly FontFace[] = ALL_FACES.filter((f) => !f.italic);

const psName = (font: unknown): string | undefined => (font as { postscriptName?: string } | undefined)?.postscriptName;

describe('createFontRegistry — lookup', () => {
  const registry = createFontRegistry(ALL_FACES);

  it('returns the regular face', () => {
    expect(psName(registry.get('Arial', 'regular', false))).toBe('LiberationSans');
  });

  it('returns the bold face', () => {
    expect(psName(registry.get('Arial', 'bold', false))).toBe('LiberationSans-Bold');
  });

  it('returns the italic face', () => {
    expect(psName(registry.get('Arial', 'regular', true))).toBe('LiberationSans-Italic');
  });

  it('returns the bold italic face', () => {
    expect(psName(registry.get('Arial', 'bold', true))).toBe('LiberationSans-BoldItalic');
  });

  it('returns a usable fontkit font (layout + unitsPerEm)', () => {
    const font = registry.get('Arial', 'regular', false);
    expect(font).toBeDefined();
    expect(font!.unitsPerEm).toBe(2048);
    expect(font!.layout('M').glyphs.length).toBe(1);
  });

  it('returns undefined for an unknown family', () => {
    expect(registry.get('Comic Sans', 'regular', false)).toBeUndefined();
    expect(registry.get('Comic Sans', 'bold', true)).toBeUndefined();
  });

  it('is deterministic: same query returns the same face', () => {
    expect(psName(registry.get('Arial', 'bold', false))).toBe(psName(registry.get('Arial', 'bold', false)));
  });
});

describe('createFontRegistry — italic fallback', () => {
  const registry = createFontRegistry(UPRIGHT_FACES);

  it('italic without an italic face falls back to the upright regular face', () => {
    expect(psName(registry.get('Arial', 'regular', true))).toBe('LiberationSans');
  });

  it('bold italic without an italic face falls back to the upright bold face', () => {
    expect(psName(registry.get('Arial', 'bold', true))).toBe('LiberationSans-Bold');
  });

  it('a missing weight is not filled by another weight', () => {
    const onlyRegular = createFontRegistry([ALL_FACES[0]!]);
    expect(onlyRegular.get('Arial', 'bold', false)).toBeUndefined();
  });
});

describe('createFontRegistry — faces', () => {
  it('preserves the registered faces', () => {
    const registry = createFontRegistry(ALL_FACES);
    expect(registry.faces).toEqual(ALL_FACES);
  });

  it('an empty registry has no faces and finds nothing', () => {
    const registry = createFontRegistry([]);
    expect(registry.faces).toEqual([]);
    expect(registry.get('Arial', 'regular', false)).toBeUndefined();
  });
});

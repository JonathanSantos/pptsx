import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import overflow from '../../examples/overflow.tsx';
import { render } from '../../src/render.ts';
import type { Diagnostic, RenderResult } from '../../src/core/types.ts';

/**
 * Regressão (M6): os 5 slides de examples/overflow.tsx continuam com os mesmos
 * códigos. Snapshot só de (slide, code, severity, path), sem mensagens.
 */

const EXAMPLES_DIR = fileURLToPath(new URL('../../examples/', import.meta.url));

const shapeOf = (d: Diagnostic) => [d.slide, d.code, d.severity, d.path] as const;
const ofSlide = (result: RenderResult, slide: number) => result.diagnostics.filter((d) => d.slide === slide);
const severities = (ds: readonly Diagnostic[]) => new Set(ds.map((d) => d.severity));

describe('examples/overflow.tsx — diagnostics regression', () => {
  const results = () => render(overflow, { sizes: ['16x9', '4x3'], preview: false, baseDir: EXAMPLES_DIR });

  it('snapshot of (slide, code, severity, path) per size', async () => {
    const all = await results();
    expect(all.map((r) => ({ size: r.size, diagnostics: r.diagnostics.map(shapeOf) }))).toMatchSnapshot();
  }, 120_000);

  // O deck foi desenhado para 16:9; no 4:3 (mais alto) alguns slides cabem e só o snapshot vale.
  it('the intent of each slide holds in 16x9', async () => {
    for (const result of (await results()).filter((r) => r.size === '16x9')) {
      // 1 · bullets encolhem juntas: só info
      expect([...severities(ofSlide(result, 1))], 'slide 1').toEqual(['info']);
      expect(ofSlide(result, 1).some((d) => d.code === 'text-shrunk')).toBe(true);
      // 2 · não cabe nem no mínimo: text-overflow error
      expect(ofSlide(result, 2).some((d) => d.code === 'text-overflow' && d.severity === 'error'), `${result.size} slide 2`).toBe(true);
      // 3 · só truncate: warning, nada de error
      expect(ofSlide(result, 3).some((d) => d.code === 'text-truncated')).toBe(true);
      expect(severities(ofSlide(result, 3)).has('error'), `${result.size} slide 3`).toBe(false);
      // 4 · truncate (warning) e fit="error" (error)
      expect(ofSlide(result, 4).some((d) => d.code === 'text-truncated' && d.severity === 'warning')).toBe(true);
      expect(ofSlide(result, 4).some((d) => d.code === 'text-overflow' && d.severity === 'error'), `${result.size} slide 4`).toBe(true);
      // 5 · box-overflow por tamanhos fixos; a decoração absoluta não gera nada
      expect(ofSlide(result, 5).some((d) => d.code === 'box-overflow' && d.severity === 'error'), `${result.size} slide 5`).toBe(true);
      expect(ofSlide(result, 5).some((d) => d.code === 'out-of-slide')).toBe(false);
    }
  }, 120_000);
});

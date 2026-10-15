import { describe, expect, it } from 'vitest';
import { join, resolve } from 'node:path';
import { exitCodeOf, mergeOptions, parseCli, summaryOf } from '../../src/cli.ts';
import { defineConfig } from '../../src/config.ts';
import type { Diagnostic, Severity } from '../../src/core/types.ts';

/** Funções puras da CLI (M5-A). Importar src/cli.ts não pode disparar o main. */

const CWD = '/work/project';

const diag = (severity: Severity, overrides: Partial<Diagnostic> = {}): Diagnostic => ({
  severity,
  code: severity === 'info' ? 'text-shrunk' : severity === 'warning' ? 'text-truncated' : 'text-overflow',
  size: '16x9',
  slide: 2,
  path: 'ContentLayout > Box > Text',
  message: `mensagem ${severity}`,
  ...overrides,
});

describe('parseCli', () => {
  it('build <deck>: deck and out resolved against cwd; defaults', () => {
    const args = parseCli(['build', 'examples/demo.tsx'], CWD);
    expect(args.deckPath).toBe(resolve(CWD, 'examples/demo.tsx'));
    expect(args.outDir).toBe(resolve(CWD, 'dist'));
    expect(args.debug).toBe(false);
    expect(args.json).toBe(false);
    expect(args.preview).toBe(true);
    expect(args.previewWidth).toBe(1280);
    // Ausentes ficam undefined para a config poder preencher.
    expect(args.sizes).toBeUndefined();
    expect(args.lang).toBeUndefined();
  });

  it('--size accepts a list with presets and a custom size in inches', () => {
    const args = parseCli(['build', 'd.tsx', '--size', '16x9,4x3,10x7.5in'], CWD);
    expect(args.sizes).toEqual(['16x9', '4x3', { width: 10, height: 7.5 }]);
  });

  it('--size with an unknown preset throws listing valid presets', () => {
    expect(() => parseCli(['build', 'd.tsx', '--size', '16x9,bogus'], CWD)).toThrow(/16x9/);
  });

  it('--out, --debug, --json, --lang', () => {
    const args = parseCli(['build', 'd.tsx', '--out', 'out/x', '--debug', '--json', '--lang', 'en-US'], CWD);
    expect(args.outDir).toBe(join(CWD, 'out/x'));
    expect(args.debug).toBe(true);
    expect(args.json).toBe(true);
    expect(args.lang).toBe('en-US');
  });

  it('--out absolute is kept', () => {
    expect(parseCli(['build', 'd.tsx', '--out', '/tmp/abs'], CWD).outDir).toBe(resolve('/tmp/abs'));
  });

  it.each([
    ['native', true],
    ['none', false],
  ] as const)('--preview %s → preview %s', (mode, expected) => {
    expect(parseCli(['build', 'd.tsx', '--preview', mode], CWD).preview).toBe(expected);
  });

  it('--preview with an invalid mode throws', () => {
    expect(() => parseCli(['build', 'd.tsx', '--preview', 'office'], CWD)).toThrow(/preview/);
  });

  it('--preview-width valid', () => {
    expect(parseCli(['build', 'd.tsx', '--preview-width', '640'], CWD).previewWidth).toBe(640);
  });

  it.each(['abc', '0', '-10', '12.5', ''])('--preview-width %j is an error', (raw) => {
    expect(() => parseCli(['build', 'd.tsx', `--preview-width=${raw}`], CWD)).toThrow(/preview-width/);
  });

  it('invalid command → usage error', () => {
    expect(() => parseCli(['compile', 'd.tsx'], CWD)).toThrow(/uso|usage/i);
    expect(() => parseCli(['compile', 'd.tsx'], CWD)).toThrow(/build/);
  });

  it('build without a deck → usage error', () => {
    expect(() => parseCli(['build'], CWD)).toThrow(/build/);
  });

  it('no arguments → usage error', () => {
    expect(() => parseCli([], CWD)).toThrow(/build/);
  });

  it('unknown flag → error', () => {
    expect(() => parseCli(['build', 'd.tsx', '--nope'], CWD)).toThrow();
  });
});

describe('mergeOptions — CLI flags win over config', () => {
  const config = defineConfig({
    fonts: [{ family: 'Inter', weight: 'regular', file: '/fonts/Inter.ttf' }],
    sizes: ['wide'],
    lang: 'es-ES',
    textSafety: 0.9,
  });

  it('config fills what the CLI did not set', () => {
    const options = mergeOptions(parseCli(['build', 'deck/d.tsx'], CWD), config);
    expect(options.sizes).toEqual(['wide']);
    expect(options.lang).toBe('es-ES');
    expect(options.fonts).toEqual(config.fonts);
    expect(options.textSafety).toBe(0.9);
  });

  it('flags win over config', () => {
    const options = mergeOptions(parseCli(['build', 'deck/d.tsx', '--size', '4x3', '--lang', 'en-US'], CWD), config);
    expect(options.sizes).toEqual(['4x3']);
    expect(options.lang).toBe('en-US');
  });

  it('no config and no flags → render defaults (undefined)', () => {
    const options = mergeOptions(parseCli(['build', 'deck/d.tsx'], CWD), {});
    expect(options.sizes).toBeUndefined();
    expect(options.lang).toBeUndefined();
    expect(options.fonts).toBeUndefined();
  });

  it('baseDir is the deck directory; preview from flags', () => {
    const native = mergeOptions(parseCli(['build', 'deck/d.tsx', '--preview-width', '320', '--debug'], CWD), {});
    expect(native.baseDir).toBe(resolve(CWD, 'deck'));
    expect(native.preview).toEqual({ mode: 'native', width: 320 });
    expect(native.debug).toBe(true);
    const none = mergeOptions(parseCli(['build', 'deck/d.tsx', '--preview', 'none'], CWD), {});
    expect(none.preview).toBe(false);
  });
});

describe('defineConfig', () => {
  it('is the identity', () => {
    const config = { lang: 'en-US' };
    expect(defineConfig(config)).toBe(config);
  });
});

describe('exitCodeOf', () => {
  it('0 with no diagnostics', () => {
    expect(exitCodeOf([])).toBe(0);
  });

  it('0 with only warning/info', () => {
    expect(exitCodeOf([diag('warning'), diag('info'), diag('info')])).toBe(0);
  });

  it('1 with any error', () => {
    expect(exitCodeOf([diag('info'), diag('error'), diag('warning')])).toBe(1);
    expect(exitCodeOf([diag('error')])).toBe(1);
  });
});

describe('summaryOf', () => {
  it('no diagnostics → a single line saying so', () => {
    const summary = summaryOf([]);
    expect(summary.split('\n')).toHaveLength(1);
    expect(summary.length).toBeGreaterThan(0);
  });

  it('counts per severity and lists each diagnostic with size, slide, code, path and message', () => {
    const summary = summaryOf([
      diag('error', { message: 'Texto estourou 12 pt', path: 'CoverLayout > Text[0]', slide: 1 }),
      diag('warning', { size: '4x3' }),
      diag('info'),
      diag('info'),
    ]);
    expect(summary).toMatch(/1 error/);
    expect(summary).toMatch(/1 warning/);
    expect(summary).toMatch(/2 info/);
    expect(summary).toContain('Texto estourou 12 pt');
    expect(summary).toContain('CoverLayout > Text[0]');
    expect(summary).toContain('text-overflow');
    expect(summary).toContain('4x3');
    expect(summary).toMatch(/slide 1/);
  });
});

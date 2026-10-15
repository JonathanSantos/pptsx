import { describe, expect, it } from 'vitest';
import { mergeOptions, parseCli } from '../../src/cli.ts';
import { defineConfig } from '../../src/config.ts';

/** --line-breaks (M7-B): flag vence config; sem nada fica undefined (o render aplica DEFAULTS.lineBreaks). */

const CWD = '/work/project';

describe('--line-breaks', () => {
  it.each(['auto', 'forced'] as const)('--line-breaks %s → mergeOptions.lineBreaks', (mode) => {
    expect(mergeOptions(parseCli(['build', 'd.tsx', '--line-breaks', mode], CWD), {}).lineBreaks).toBe(mode);
  });

  it('accepts the --line-breaks=auto form', () => {
    expect(mergeOptions(parseCli(['build', 'd.tsx', '--line-breaks=auto'], CWD), {}).lineBreaks).toBe('auto');
  });

  it('config lineBreaks fills when the flag is absent', () => {
    const config = defineConfig({ lineBreaks: 'auto' });
    expect(mergeOptions(parseCli(['build', 'd.tsx'], CWD), config).lineBreaks).toBe('auto');
  });

  it('flag wins over config', () => {
    const config = defineConfig({ lineBreaks: 'auto' });
    expect(mergeOptions(parseCli(['build', 'd.tsx', '--line-breaks', 'forced'], CWD), config).lineBreaks).toBe('forced');
  });

  it('invalid value → error naming both valid values', () => {
    const parse = () => parseCli(['build', 'd.tsx', '--line-breaks', 'x'], CWD);
    expect(parse).toThrow(/line-breaks/);
    expect(parse).toThrow(/forced/);
    expect(parse).toThrow(/auto/);
  });

  it('nothing set → undefined', () => {
    expect(mergeOptions(parseCli(['build', 'd.tsx'], CWD), {}).lineBreaks).toBeUndefined();
  });

  it('other options are unaffected by the flag', () => {
    const options = mergeOptions(parseCli(['build', 'd.tsx', '--line-breaks', 'auto', '--lang', 'en-US'], CWD), {});
    expect(options.lang).toBe('en-US');
  });
});

import { describe, expect, it } from 'vitest';
import {
  activeBreakpointsOf,
  isBreakpointName,
  isResponsive,
  pickResponsive,
  responsiveProblemOf,
} from '../../src/core/responsive.ts';
import { DEFAULTS } from '../../src/core/defaults.ts';
import type { DeckContext, Responsive, SizeSpec } from '../../src/core/types.ts';
import { createContext, resolveSize } from '../../src/sizes.ts';

/** CONTRACTS §M9 "src/core/responsive.ts": breakpoints ativos, precedência e objetos malformados. */

const ctxOf = (spec: SizeSpec): DeckContext => createContext(resolveSize(spec));

const CTX = {
  '16x9': ctxOf('16x9'),
  '16x10': ctxOf('16x10'),
  '4x3': ctxOf('4x3'),
  wide: ctxOf('wide'),
  /** 720×540 pt: aspect 4/3 (tall), scale 1, nome custom-10x7.5. */
  custom4x3: ctxOf({ width: 10, height: 7.5 }),
  /** 959.76×720 pt: aspect 4/3 (tall) e scale ≈ 1.33 (wide) ao mesmo tempo. */
  customWideTall: ctxOf({ width: 13.33, height: 10 }),
  /** 959.76×540 pt: wide sem ser o preset e sem ser tall. */
  customWide: ctxOf({ width: 13.33, height: 7.5 }),
} as const;

describe('preconditions of the contexts', () => {
  it('custom 13.33x10in is both tall and wide', () => {
    expect(CTX.customWideTall.aspect).toBeLessThan(DEFAULTS.breakpoints.tallAspect);
    expect(CTX.customWideTall.scale).toBeGreaterThan(DEFAULTS.breakpoints.wideScale);
  });

  it('custom 10x7.5in is named custom-10x7.5', () => {
    expect(CTX.custom4x3.name).toBe('custom-10x7.5');
  });
});

describe('isBreakpointName', () => {
  it.each(['tall', 'wide', '16x9', '16x10', '4x3', 'custom-10x7.5'])('%s is a breakpoint', (key) => {
    expect(isBreakpointName(key)).toBe(true);
  });

  it.each(['base', 'tal', 'Wide', '16:9', 'top', 'image', ''])('%s is not a breakpoint', (key) => {
    expect(isBreakpointName(key)).toBe(false);
  });
});

describe('activeBreakpointsOf', () => {
  it('16x9 → only its name', () => {
    expect(activeBreakpointsOf(CTX['16x9'])).toEqual(['16x9']);
  });

  it('4x3 → name, then tall', () => {
    expect(activeBreakpointsOf(CTX['4x3'])).toEqual(['4x3', 'tall']);
  });

  it('16x10 (aspect 1.6) is not tall', () => {
    expect(activeBreakpointsOf(CTX['16x10'])).toEqual(['16x10']);
  });

  it('wide preset → wide first, never tall', () => {
    // O preset ativa 'wide' pelo nome e pela escala; a ordem/duplicata não muda a precedência.
    const active = activeBreakpointsOf(CTX.wide);
    expect(active[0]).toBe('wide');
    expect([...new Set(active)]).toEqual(['wide']);
  });

  it('custom 10x7.5in → custom-10x7.5, then tall', () => {
    expect(activeBreakpointsOf(CTX.custom4x3)).toEqual(['custom-10x7.5', 'tall']);
  });

  it('custom 13.33x10in → name, wide, tall (in this order)', () => {
    expect(activeBreakpointsOf(CTX.customWideTall)).toEqual(['custom-13.33x10', 'wide', 'tall']);
  });

  it('custom 13.33x7.5in → name, wide', () => {
    expect(activeBreakpointsOf(CTX.customWide)).toEqual(['custom-13.33x7.5', 'wide']);
  });
});

describe('pickResponsive — precedence', () => {
  const size: Responsive<number> = { base: 20, tall: 24, '4x3': 26 };

  it('4x3 → exact name (26)', () => {
    expect(pickResponsive(size, CTX['4x3'])).toBe(26);
  });

  it('16x9 → base (20)', () => {
    expect(pickResponsive(size, CTX['16x9'])).toBe(20);
  });

  it('custom 10x7.5in → tall (24)', () => {
    expect(pickResponsive(size, CTX.custom4x3)).toBe(24);
  });

  it('custom 10x7.5in answers to its own name', () => {
    expect(pickResponsive({ base: 1, tall: 2, 'custom-10x7.5': 3 }, CTX.custom4x3)).toBe(3);
  });

  it('wide beats tall when both apply', () => {
    expect(pickResponsive({ base: 1, tall: 2, wide: 3 }, CTX.customWideTall)).toBe(3);
  });

  it('tall applies to the wide+tall custom when there is no wide key', () => {
    expect(pickResponsive({ base: 1, tall: 2 }, CTX.customWideTall)).toBe(2);
  });

  it('exact name beats wide', () => {
    expect(pickResponsive({ base: 1, wide: 2, 'custom-13.33x10': 3 }, CTX.customWideTall)).toBe(3);
  });

  it('exact name beats tall in 4x3 (wide key ignored there)', () => {
    expect(pickResponsive({ base: 1, wide: 2, '4x3': 3 }, CTX['4x3'])).toBe(3);
  });

  it('wide preset picks wide; 16x9 ignores wide', () => {
    const value: Responsive<number> = { base: 1, wide: 2, tall: 3 };
    expect(pickResponsive(value, CTX.wide)).toBe(2);
    expect(pickResponsive(value, CTX['16x9'])).toBe(1);
  });

  it('a custom wide (not the preset) picks wide', () => {
    expect(pickResponsive({ base: 1, wide: 2 }, CTX.customWide)).toBe(2);
  });

  it('16x10 falls to base (neither tall nor wide)', () => {
    expect(pickResponsive({ base: 1, tall: 2, wide: 3, '4x3': 4 }, CTX['16x10'])).toBe(1);
  });

  it('a key present with undefined falls to the next one', () => {
    expect(pickResponsive({ base: 1, '4x3': undefined, tall: 2 }, CTX['4x3'])).toBe(2);
    expect(pickResponsive({ base: 1, tall: undefined }, CTX['4x3'])).toBe(1);
    expect(pickResponsive({ base: 1, wide: undefined, tall: 2 }, CTX.customWideTall)).toBe(2);
  });

  it('works with non-numeric values', () => {
    expect(pickResponsive<'row' | 'column'>({ base: 'row', tall: 'column' }, CTX['4x3'])).toBe('column');
    expect(pickResponsive<boolean>({ base: false, tall: true }, CTX['16x9'])).toBe(false);
  });
});

describe('pickResponsive — non-responsive values pass through', () => {
  it('a plain value is returned as is', () => {
    expect(pickResponsive(5, CTX['4x3'])).toBe(5);
    expect(pickResponsive('#ff0000', CTX['4x3'])).toBe('#ff0000');
  });

  it('padding-like and background-like objects are returned by identity', () => {
    const padding = { top: 10 };
    const background = { image: 'x.png' };
    expect(pickResponsive(padding, CTX['4x3'])).toBe(padding);
    expect(pickResponsive(background, CTX['4x3'])).toBe(background);
  });

  it('an object value inside base is returned as is', () => {
    const padding = { top: 10 };
    expect(pickResponsive({ base: padding, tall: { top: 20 } }, CTX['16x9'])).toBe(padding);
    expect(pickResponsive({ base: padding, tall: { top: 20 } }, CTX['4x3'])).toEqual({ top: 20 });
  });
});

describe('isResponsive', () => {
  it('true for an object with own key base', () => {
    expect(isResponsive({ base: 1 })).toBe(true);
    expect(isResponsive({ base: 1, tall: 2 })).toBe(true);
    expect(isResponsive<number | undefined>({ base: undefined })).toBe(true);
  });

  it.each([
    ['{ top: 10 }', { top: 10 }],
    ["{ image: 'x' }", { image: 'x' }],
    ['an array', [1, 2]],
    ['an array of objects with base', [{ base: 1 }]],
    ['null', null],
    ['a number', 3],
    ['a string', 'base'],
    ['undefined', undefined],
    ['{}', {}],
  ] as const)('false for %s', (_, value) => {
    expect(isResponsive<unknown>(value)).toBe(false);
  });

  it('false for an inherited base (not an own key)', () => {
    expect(isResponsive<unknown>(Object.create({ base: 1 }) as unknown)).toBe(false);
  });
});

describe('responsiveProblemOf', () => {
  it('{ tall: 24 } → missing base', () => {
    expect(responsiveProblemOf({ tall: 24 })).toBe('objeto responsivo sem a chave "base"');
  });

  it("{ '4x3': 1, wide: 2 } → missing base", () => {
    expect(responsiveProblemOf({ '4x3': 1, wide: 2 })).toBe('objeto responsivo sem a chave "base"');
  });

  it('{ base: 1, tal: 2 } → unknown breakpoint', () => {
    expect(responsiveProblemOf({ base: 1, tal: 2 })).toBe('breakpoint desconhecido: "tal"');
  });

  it.each([
    ['{}', {}],
    ['{ top: 1 }', { top: 1 }],
    ["{ image: 'x' }", { image: 'x' }],
    ['{ base: 1, tall: 2 }', { base: 1, tall: 2 }],
    ["{ base: 1, 'custom-10x7.5': 2 }", { base: 1, 'custom-10x7.5': 2 }],
    ['a number', 1],
    ['null', null],
    ['an array', [{ tall: 1 }]],
    ['undefined', undefined],
  ] as const)('%s → undefined', (_, value) => {
    expect(responsiveProblemOf(value)).toBeUndefined();
  });
});

describe('createContext().pick', () => {
  it('uses the same rule as pickResponsive', () => {
    const value: Responsive<number> = { base: 20, tall: 24, wide: 28, '4x3': 26 };
    for (const ctx of Object.values(CTX)) expect(ctx.pick(value)).toBe(pickResponsive(value, ctx));
  });
});

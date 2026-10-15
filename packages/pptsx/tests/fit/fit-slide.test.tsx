import { describe, expect, it } from 'vitest';
import { fitSlide, detectOverflow, type FitResult } from '../../src/fit/index.ts';
import type {
  Diagnostic,
  LayoutEnv,
  PositionedNode,
  PositionedSlide,
  PositionedText,
  ResolvedSlide,
  SlideElement,
  SlideSize,
} from '../../src/core/types.ts';
import { DEFAULTS, minSizeOf, textStyleOf } from '../../src/core/defaults.ts';
import { Box, Deck, Image, Shape, Slide, Text } from '../../src/primitives/index.ts';
import { resolveDeck } from '../../src/resolve/index.ts';
import { createContext, resolveSize } from '../../src/sizes.ts';
import { createFontRegistry, createFontkitMeasurer } from '../../src/text/index.ts';
import { DEFAULT_FONTS } from '../../src/fonts/index.ts';
import { SIZE_16X9, SIZE_4X3 } from '../helpers/nodes.ts';
import { allMemberPaths } from '../helpers/diagnostics.ts';

/** M9: resolveDeck exige ctx; estes testes não usam props responsivas, então 16x9 basta. */
const RESOLVE_CTX = createContext(resolveSize('16x9'));

// ───────────── ambiente real ─────────────

const SMALL_IMAGE = 'small.png'; // 40×20 px
const env: LayoutEnv = {
  measureText: createFontkitMeasurer(createFontRegistry(DEFAULT_FONTS)),
  imageSize: (src) => (src === SMALL_IMAGE ? { width: 40, height: 20 } : { width: 4000, height: 2000 }),
};

const lineHeightAt = (size: number): number =>
  env.measureText({ content: 'x', style: textStyleOf({ size }), maxWidth: Infinity }).lineHeight;

const resolveSlide = (slide: SlideElement): ResolvedSlide => {
  const deck = resolveDeck(<Deck>{slide}</Deck>, RESOLVE_CTX);
  const first = deck.slides[0];
  if (!first) throw new Error('no slide');
  return first;
};

const fit = (slide: SlideElement, opts: { size?: SlideSize; slideIndex?: number } = {}): FitResult =>
  fitSlide({ slide: resolveSlide(slide), slideIndex: opts.slideIndex ?? 0, size: opts.size ?? SIZE_16X9, env });

const allNodes = (slide: PositionedSlide): PositionedNode[] => {
  const out: PositionedNode[] = [];
  const walk = (nodes: readonly PositionedNode[]) => {
    for (const n of nodes) {
      out.push(n);
      if (n.kind === 'box') walk(n.children);
    }
  };
  walk(slide.children);
  return out;
};
const texts = (slide: PositionedSlide): PositionedText[] =>
  allNodes(slide).filter((n): n is PositionedText => n.kind === 'text');
const textAt = (slide: PositionedSlide, path: string): PositionedText => {
  const t = texts(slide).find((n) => n.path === path);
  if (!t) throw new Error(`no text at ${path}; have ${texts(slide).map((n) => n.path).join(', ')}`);
  return t;
};
const byCode = (r: FitResult, code: Diagnostic['code']) => r.diagnostics.filter((d) => d.code === code);

const LOREM =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ' +
  'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';
const longText = (times: number) => Array.from({ length: times }, () => LOREM).join(' ');

// ───────────── componentes ─────────────

const Header = ({ title }: { title: string }) => (
  <Text fontSize={36} fontWeight="bold" flexShrink={0}>
    {title}
  </Text>
);

const BULLET_SIZE = 24;
const BULLET_COUNT = 12;
const bulletItems = Array.from({ length: BULLET_COUNT }, (_, i) => `Item ${i + 1} da lista`);

const Bullets = ({ items, size = BULLET_SIZE }: { items: readonly string[]; size?: number }) => (
  <Box flex={1}>
    {items.map((item) => (
      <Text fontSize={size} fit="shrink">
        {item}
      </Text>
    ))}
  </Box>
);

const crowded = () => (
  <Slide padding={40}>
    <Header title="Título do slide" />
    <Bullets items={bulletItems} />
  </Slide>
);

// ───────────── casos ─────────────

describe('fitSlide — nothing overflows', () => {
  const slide = () => (
    <Slide padding={40} gap={10}>
      <Header title="Tudo cabe" />
      <Bullets items={['um', 'dois', 'três']} />
    </Slide>
  );

  it('no diagnostics and sizes intact', () => {
    const r = fit(slide());
    expect(r.diagnostics).toEqual([]);
    expect(textAt(r.slide, 'Slide > Header').text.fontSize).toBe(36);
    for (const t of texts(r.slide).filter((t) => t.path.startsWith('Slide > Bullets'))) {
      expect(t.text.fontSize).toBe(BULLET_SIZE);
      expect(t.props.size).toBe(BULLET_SIZE);
    }
  });

  it('result is a full positioned slide (same tree as plain layout would produce)', () => {
    const r = fit(slide());
    expect(r.slide.kind).toBe('slide');
    expect(r.slide.frame).toEqual({ x: 0, y: 0, width: 720, height: 405 });
    expect(texts(r.slide)).toHaveLength(4);
    expect(detectOverflow(r.slide)).toEqual([]);
  });
});

describe('fitSlide — shrink policy (scope = component)', () => {
  const r = fit(crowded());
  const bullets = () => texts(r.slide).filter((t) => t.path.startsWith('Slide > Bullets > Text'));

  it('precondition: the body overflows at the authored size', () => {
    const available = 405 - 80 - lineHeightAt(36);
    expect(BULLET_COUNT * lineHeightAt(BULLET_SIZE)).toBeGreaterThan(available + DEFAULTS.fit.epsilon);
  });

  it('all bullets shrink together to the same size', () => {
    const sizes = bullets().map((t) => t.text.fontSize);
    expect(sizes).toHaveLength(BULLET_COUNT);
    expect(new Set(sizes).size).toBe(1);
    const final = sizes[0]!;
    expect(final).toBeLessThan(BULLET_SIZE);
    expect(final).toBeGreaterThanOrEqual(minSizeOf({ size: BULLET_SIZE }));
    expect(Number.isInteger(final)).toBe(true);
    for (const t of bullets()) expect(t.props.size).toBe(final);
  });

  it('steps of 1 pt: stops at the largest size that fits', () => {
    const final = bullets()[0]!.text.fontSize;
    const boxHeight = allNodes(r.slide).find((n) => n.path === 'Slide > Bullets')!.frame.height;
    expect(BULLET_COUNT * lineHeightAt(final)).toBeLessThanOrEqual(boxHeight + DEFAULTS.fit.epsilon);
    expect(BULLET_COUNT * lineHeightAt(final + 1)).toBeGreaterThan(boxHeight + DEFAULTS.fit.epsilon);
  });

  it('after fitting nothing overflows', () => {
    expect(detectOverflow(r.slide)).toEqual([]);
  });

  it('text-shrunk info covering every bullet with fromSize/toSize and its path', () => {
    const final = bullets()[0]!.text.fontSize;
    const shrunk = byCode(r, 'text-shrunk');
    // M6: os 12 irmãos viram um diagnóstico agrupado; os paths individuais ficam em data.paths.
    expect(allMemberPaths(shrunk).sort()).toEqual(bullets().map((t) => t.path).sort());
    expect(allMemberPaths(shrunk)).toContain('Slide > Bullets > Text[0]');
    for (const d of shrunk) {
      expect(d.severity).toBe('info');
      expect(d.data?.fromSize).toBe(BULLET_SIZE);
      expect(d.data?.toSize).toBe(final);
    }
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('the title in a separate Header component does not shrink', () => {
    const title = textAt(r.slide, 'Slide > Header');
    expect(title.text.fontSize).toBe(36);
    expect(title.props.size).toBe(36);
    expect(r.diagnostics.some((d) => d.path === 'Slide > Header')).toBe(false);
  });
});

describe('fitSlide — shrink cannot fit', () => {
  const slide = (size: number, extra: Record<string, unknown> = {}) => (
    <Slide padding={40}>
      <Box height={60}>
        <Text fontSize={size} {...extra}>
          {longText(3)}
        </Text>
      </Box>
    </Slide>
  );

  it('text-overflow error with fromSize/toSize and overflowPct > 0; final size = minSize', () => {
    const r = fit(slide(24));
    const t = textAt(r.slide, 'Slide > Box > Text');
    expect(t.text.fontSize).toBe(18);
    expect(t.props.size).toBe(18);
    const errs = byCode(r, 'text-overflow');
    expect(errs).toHaveLength(1);
    const d = errs[0]!;
    expect(d.severity).toBe('error');
    expect(d.path).toBe('Slide > Box > Text');
    expect(d.data?.fromSize).toBe(24);
    expect(d.data?.toSize).toBe(18);
    expect(d.data?.overflowPct).toBeGreaterThan(0);
    expect(d.data?.overflowPt).toBeGreaterThan(0);
    expect(byCode(r, 'text-shrunk')).toEqual([]);
  });

  it('default minSize = floor(0.75 × size) (22 → 16)', () => {
    const r = fit(slide(22));
    expect(textAt(r.slide, 'Slide > Box > Text').text.fontSize).toBe(16);
    expect(byCode(r, 'text-overflow')[0]?.data?.toSize).toBe(16);
  });

  it('explicit minSize is honored', () => {
    const r = fit(slide(24, { minSize: 20 }));
    expect(textAt(r.slide, 'Slide > Box > Text').text.fontSize).toBe(20);
    expect(byCode(r, 'text-overflow')[0]?.data?.toSize).toBe(20);
  });
});

describe('fitSlide — binary search reaches the size that fits (M6)', () => {
  // Só cabe em ~20 pt: 40 pt abaixo do original, muito além de 12 passos de 1 pt.
  const height = () => lineHeightAt(20) + 0.5;
  const slide = () => (
    <Slide padding={40}>
      <Box height={height()}>
        <Text fontSize={60} minSize={10}>
          Texto
        </Text>
      </Box>
    </Slide>
  );

  it('ends at the largest size that fits (20), with text-shrunk and no text-overflow', () => {
    expect(lineHeightAt(21)).toBeGreaterThan(height());
    expect(lineHeightAt(20)).toBeLessThanOrEqual(height());
    const r = fit(slide());
    const t = textAt(r.slide, 'Slide > Box > Text');
    expect(t.text.fontSize).toBe(20);
    expect(byCode(r, 'text-overflow')).toEqual([]);
    const [shrunk] = byCode(r, 'text-shrunk');
    expect(shrunk).toMatchObject({ severity: 'info', path: 'Slide > Box > Text', data: { fromSize: 60, toSize: 20 } });
  });

  it('no message about stopping after N steps', () => {
    const r = fit(slide());
    for (const d of r.diagnostics) expect(d.message).not.toMatch(/parou após/);
  });
});

describe('fitSlide — truncate policy', () => {
  const slide = () => (
    <Slide padding={40}>
      <Box height={60}>
        <Text fontSize={18} fit="truncate">
          {longText(3)}
        </Text>
      </Box>
    </Slide>
  );

  it('text-truncated warning; last line ends with …; text fits the frame; size intact', () => {
    const r = fit(slide());
    const t = textAt(r.slide, 'Slide > Box > Text');
    const warns = byCode(r, 'text-truncated');
    expect(warns).toHaveLength(1);
    expect(warns[0]!.severity).toBe('warning');
    expect(warns[0]!.path).toBe('Slide > Box > Text');
    expect(t.text.truncated).toBe(true);
    expect(t.text.lines.at(-1)!.endsWith('…')).toBe(true);
    expect(t.text.height).toBeLessThanOrEqual(t.frame.height + DEFAULTS.fit.epsilon);
    expect(t.text.lines).toHaveLength(Math.max(1, Math.floor(60 / t.text.lineHeight)));
    expect(t.text.fontSize).toBe(18);
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('explicit maxLines that cuts → text-truncated warning', () => {
    const r = fit(
      <Slide padding={40}>
        <Text fontSize={18} maxLines={1}>
          {LOREM}
        </Text>
      </Slide>,
    );
    const warns = byCode(r, 'text-truncated');
    expect(warns).toHaveLength(1);
    expect(warns[0]!.severity).toBe('warning');
    expect(warns[0]!.path).toBe('Slide > Text');
    const t = textAt(r.slide, 'Slide > Text');
    expect(t.text.lines).toHaveLength(1);
    expect(t.text.fontSize).toBe(18);
  });

  it('maxLines that does not cut → no diagnostic', () => {
    const r = fit(
      <Slide padding={40}>
        <Text fontSize={18} maxLines={3}>
          curto
        </Text>
      </Slide>,
    );
    expect(r.diagnostics).toEqual([]);
  });
});

describe('fitSlide — error policy', () => {
  it('overflowing fit="error" → text-overflow error, size intact', () => {
    const r = fit(
      <Slide padding={40}>
        <Box height={60}>
          <Text fontSize={24} fit="error">
            {longText(3)}
          </Text>
        </Box>
      </Slide>,
    );
    const t = textAt(r.slide, 'Slide > Box > Text');
    expect(t.text.fontSize).toBe(24);
    expect(t.props.size).toBe(24);
    const errs = byCode(r, 'text-overflow');
    expect(errs).toHaveLength(1);
    expect(errs[0]!.severity).toBe('error');
    expect(errs[0]!.data?.overflowPt).toBeGreaterThan(0);
    expect(errs[0]!.data?.overflowPct).toBeGreaterThan(0);
    expect(byCode(r, 'text-shrunk')).toEqual([]);
    expect(byCode(r, 'text-truncated')).toEqual([]);
  });

  it('fit="error" texts are not shrunk even when siblings in the same scope are', () => {
    const r = fit(
      <Slide padding={40}>
        <Box height={60}>
          <Text fontSize={24} fit="error">
            {LOREM}
          </Text>
          <Text fontSize={24}>{LOREM}</Text>
        </Box>
      </Slide>,
    );
    expect(textAt(r.slide, 'Slide > Box > Text[0]').text.fontSize).toBe(24);
  });
});

describe('fitSlide — box, slide, decoration', () => {
  it('box-overflow error for fixed-size children larger than the box', () => {
    const r = fit(
      <Slide padding={40}>
        <Box height={100}>
          <Shape kind="rect" height={80} flexShrink={0} />
          <Shape kind="rect" height={80} flexShrink={0} />
        </Box>
      </Slide>,
    );
    const errs = byCode(r, 'box-overflow');
    expect(errs).toHaveLength(1);
    expect(errs[0]!.severity).toBe('error');
    expect(errs[0]!.path).toBe('Slide > Box');
    expect(errs[0]!.data?.overflowPt).toBeCloseTo(60, 3);
    expect(errs[0]!.data?.overflowPct).toBeGreaterThan(0);
  });

  it('out-of-slide error for an in-flow node past the slide', () => {
    const r = fit(
      <Slide>
        <Shape kind="rect" width={800} height={50} />
      </Slide>,
    );
    const errs = byCode(r, 'out-of-slide');
    expect(errs.length).toBeGreaterThanOrEqual(1);
    const d = errs.find((e) => e.path === 'Slide > Shape')!;
    expect(d).toBeDefined();
    expect(d.severity).toBe('error');
    expect(d.data?.overflowPt).toBeCloseTo(80, 3);
  });

  it('Box with a fixed child that leaves the slide → 1 box-overflow and 0 out-of-slide', () => {
    const r = fit(
      <Slide padding={40}>
        <Box display="flex" width={200} height={60}>
          <Shape kind="rect" width={800} height={50} flexShrink={0} />
        </Box>
      </Slide>,
    );
    expect(byCode(r, 'box-overflow')).toHaveLength(1);
    expect(byCode(r, 'box-overflow')[0]!.path).toBe('Slide > Box');
    expect(byCode(r, 'out-of-slide')).toHaveLength(0);
  });

  it('a node leaving the page at Slide level → out-of-slide, not box-overflow of the Slide', () => {
    const r = fit(
      <Slide>
        <Shape kind="rect" width={800} height={50} />
      </Slide>,
    );
    expect(byCode(r, 'out-of-slide').map((d) => d.path)).toEqual(['Slide > Shape']);
    expect(byCode(r, 'box-overflow')).toEqual([]);
  });

  it('absolute decoration outside the slide → no diagnostic', () => {
    const r = fit(
      <Slide padding={40}>
        <Shape kind="ellipse" position="absolute" left={-100} top={-100} width={300} height={300} fill="#ff8800" />
        <Box position="absolute" left={600} top={300} width={300} height={300}>
          <Shape kind="rect" width={400} height={400} />
        </Box>
        <Text>Conteúdo</Text>
      </Slide>,
    );
    expect(r.diagnostics).toEqual([]);
  });
});

describe('fitSlide — font and image', () => {
  it('font-missing error for an unregistered family', () => {
    const r = fit(
      <Slide padding={40}>
        <Text fontFamily="Família Inexistente">Olá</Text>
      </Slide>,
    );
    const errs = byCode(r, 'font-missing');
    expect(errs).toHaveLength(1);
    expect(errs[0]!.severity).toBe('error');
    expect(errs[0]!.path).toBe('Slide > Text');
    expect(errs[0]!.message.length).toBeGreaterThan(0);
  });

  it('image-upscaled info when drawn larger than px × 0.75', () => {
    const r = fit(
      <Slide padding={40}>
        <Image src={SMALL_IMAGE} width={400} height={200} />
      </Slide>,
    );
    const infos = byCode(r, 'image-upscaled');
    expect(infos).toHaveLength(1);
    expect(infos[0]!.severity).toBe('info');
    expect(infos[0]!.path).toBe('Slide > Image');
  });

  it('large image drawn small → no diagnostic', () => {
    const r = fit(
      <Slide padding={40}>
        <Image src="big.png" width={400} height={200} />
      </Slide>,
    );
    expect(r.diagnostics).toEqual([]);
  });
});

describe('fitSlide — Diagnostic fields', () => {
  it('size = size.name, slide = slideIndex + 1, path from resolve', () => {
    const r = fit(crowded(), { size: SIZE_4X3, slideIndex: 2 });
    const all = [
      ...r.diagnostics,
      ...fit(
        <Slide padding={40}>
          <Box height={60}>
            <Text fontSize={24}>{longText(3)}</Text>
          </Box>
        </Slide>,
        { size: SIZE_4X3, slideIndex: 2 },
      ).diagnostics,
    ];
    expect(all.length).toBeGreaterThan(0);
    for (const d of all) {
      expect(d.size).toBe('4x3');
      expect(d.slide).toBe(3);
      expect(d.path).toMatch(/^Slide( > [A-Z][A-Za-z]*(\[[\d.,]+\])?)+$/);
      expect(typeof d.message).toBe('string');
      expect(d.message.trim().length).toBeGreaterThan(0);
    }
  });

  it('text-shrunk message mentions the final size', () => {
    const r = fit(crowded());
    const d = byCode(r, 'text-shrunk')[0]!;
    expect(d.message).toContain(String(d.data!.toSize));
  });

  it('text-overflow message mentions the percentage and the size (Portuguese)', () => {
    const r = fit(
      <Slide padding={40}>
        <Box height={60}>
          <Text fontSize={24}>{longText(3)}</Text>
        </Box>
      </Slide>,
    );
    const d = byCode(r, 'text-overflow')[0]!;
    expect(d.message).toMatch(/\d+\s*%/);
    expect(d.message).toContain(String(d.data!.toSize));
    expect(d.message).toMatch(/texto|fonte|reduza|aumente|estour/i);
  });

  it('box-overflow message (vertical) cites the axis, the children sum and the content area in pt', () => {
    const r = fit(
      <Slide padding={40}>
        <Box height={100}>
          <Shape kind="rect" height={80} flexShrink={0} />
          <Shape kind="rect" height={80} flexShrink={0} />
        </Box>
      </Slide>,
    );
    const d = byCode(r, 'box-overflow')[0]!;
    expect(d.message).toMatch(/vertical/i);
    expect(d.message).toMatch(/\b160\b/);
    expect(d.message).toMatch(/\b100\b/);
    expect(d.message).toMatch(/pt/);
  });

  it('box-overflow message (horizontal) cites the axis, the children sum and the content area', () => {
    const r = fit(
      <Slide padding={40}>
        <Box display="flex" width={200} height={60}>
          <Shape kind="rect" width={150} height={50} flexShrink={0} />
          <Shape kind="rect" width={150} height={50} flexShrink={0} />
        </Box>
      </Slide>,
    );
    const d = byCode(r, 'box-overflow')[0]!;
    expect(d.message).toMatch(/horizontal/i);
    expect(d.message).toMatch(/\b300\b/);
    expect(d.message).toMatch(/\b200\b/);
  });

  const absoluteIsOnlyACaveat = (message: string, sideIndex: number) => {
    const abs = message.indexOf('absolute');
    if (abs >= 0) expect(abs).toBeGreaterThan(sideIndex);
  };

  it('out-of-slide message cites the side (right) and how much; absolute only as a final caveat', () => {
    const r = fit(
      <Slide>
        <Shape kind="rect" width={800} height={50} />
      </Slide>,
    );
    const d = byCode(r, 'out-of-slide')[0]!;
    const side = d.message.indexOf('pela direita');
    expect(side).toBeGreaterThanOrEqual(0);
    expect(d.message).toMatch(/\b80\b/);
    absoluteIsOnlyACaveat(d.message, side);
  });

  it('out-of-slide message cites the bottom side', () => {
    const r = fit(
      <Slide>
        <Shape kind="rect" width={100} height={500} flexShrink={0} />
      </Slide>,
    );
    const d = byCode(r, 'out-of-slide')[0]!;
    const side = d.message.indexOf('pela base');
    expect(side).toBeGreaterThanOrEqual(0);
    expect(d.message).toMatch(/\b95\b/);
    absoluteIsOnlyACaveat(d.message, side);
  });

  it('text-truncated message: "mostradas N de M linhas (~P% do conteúdo oculto)"', () => {
    const r = fit(
      <Slide padding={40}>
        <Box height={60}>
          <Text fontSize={18} fit="truncate">
            {longText(3)}
          </Text>
        </Box>
      </Slide>,
    );
    const t = textAt(r.slide, 'Slide > Box > Text');
    const d = byCode(r, 'text-truncated')[0]!;
    const m = /mostradas (\d+) de (\d+) linhas \(~(\d+)% do conteúdo oculto\)/.exec(d.message);
    expect(m, d.message).not.toBeNull();
    const shown = Number(m![1]);
    const total = Number(m![2]);
    const pct = Number(m![3]);
    expect(shown).toBe(t.text.lines.length);
    const full = env.measureText({
      content: t.content,
      style: textStyleOf(t.props),
      maxWidth: t.frame.width,
    }).lines.length;
    expect(total).toBe(full);
    expect(Math.abs(pct - ((total - shown) / total) * 100)).toBeLessThanOrEqual(1);
  });

});

describe('fitSlide — purity', () => {
  it('does not mutate the resolved input tree', () => {
    const resolved = resolveSlide(crowded());
    const snapshot = structuredClone(resolved);
    fitSlide({ slide: resolved, slideIndex: 0, size: SIZE_16X9, env });
    expect(resolved).toEqual(snapshot);
  });

  it('works with a deeply frozen input', () => {
    const deepFreeze = <T,>(o: T): T => {
      if (o && typeof o === 'object') {
        Object.values(o).forEach(deepFreeze);
        Object.freeze(o);
      }
      return o;
    };
    const resolved = deepFreeze(structuredClone(resolveSlide(crowded())));
    expect(() => fitSlide({ slide: resolved, slideIndex: 0, size: SIZE_16X9, env })).not.toThrow();
  });

  it('is deterministic', () => {
    const a = fit(crowded());
    const b = fit(crowded());
    expect(a).toEqual(b);
  });
});

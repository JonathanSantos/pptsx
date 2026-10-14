import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { fitDeck, fitSlide, type FitDeckResult } from '../../src/fit/index.ts';
import type {
  Diagnostic,
  LayoutEnv,
  PositionedBox,
  PositionedNode,
  PositionedSlide,
  ResolvedDeck,
  SlideElement,
  SlideSize,
} from '../../src/core/types.ts';
import { DEFAULTS } from '../../src/core/defaults.ts';
import { defineDeck } from '../../src/index.ts';
import { Box, Deck, Image, Shape, Slide, Text } from '../../src/primitives/index.ts';
import { render } from '../../src/render.ts';
import { resolveDeck } from '../../src/resolve/index.ts';
import { createContext } from '../../src/sizes.ts';
import { SIZE_16X9, SIZE_4X3, createFakeEnv } from '../helpers/nodes.ts';
import { allNodes, lazy, realEnv } from '../helpers/fit-env.tsx';
import { allMemberPaths, memberPaths } from '../helpers/diagnostics.ts';

/**
 * CONTRACTS §M9 "src/fit/ + src/render.ts (M9-B)": slide de continuação.
 *
 * Geometria com o medidor falso (20 pt por linha, independe do size): Slide padding 24, gap 20,
 * título de 1 linha (20 pt), Box paginate com gap 20 e itens de 2 linhas (40 pt).
 * Área do Box = altura − 48 − 20 − 20; cabem k itens com 40k + 20(k − 1) ≤ área:
 * 16x9 (área 317) → 5 por parte (5, 5, 2); 4x3 (área 452) → 7 por parte (7, 5).
 */

const P = 'Slide > Box';
const TITLE = 'Slide > Text';

const item = (i: number, lines = 2) => (
  <Box>
    <Text>{[`Item ${i + 1}`, ...Array.from({ length: lines - 1 }, (_, l) => `linha ${l + 2}`)].join('\n')}</Text>
  </Box>
);

const listSlide = (lineCounts: readonly number[], extra?: SlideElement) => (
  <Slide padding={24} gap={20} notes="Notas do apresentador">
    <Text>Título da lista</Text>
    <Box paginate grow={1} gap={20}>
      <Shape kind="rect" position="absolute" left={0} top={0} width={4} height="100%" fill="#cccccc" />
      {lineCounts.map((lines, i) => item(i, lines))}
    </Box>
    {extra}
  </Slide>
);

const twelveItems = Array.from({ length: 12 }, () => 2);

const resolveAll = (slides: readonly SlideElement[], size: SlideSize): ResolvedDeck =>
  resolveDeck(<Deck>{slides}</Deck>, createContext(size));

const fitAll = (slides: readonly SlideElement[], size: SlideSize = SIZE_16X9, env: LayoutEnv = createFakeEnv().env): FitDeckResult =>
  fitDeck({ deck: resolveAll(slides, size), size, env });

const boxAt = (slide: PositionedSlide, path: string): PositionedBox => {
  const node = allNodes(slide).find((n): n is PositionedBox => n.kind === 'box' && n.path === path);
  if (!node) throw new Error(`no box at ${path}`);
  return node;
};

const inFlow = (box: PositionedBox): PositionedNode[] => box.children.filter((c) => c.props.position !== 'absolute');
const absolutes = (box: PositionedBox): PositionedNode[] => box.children.filter((c) => c.props.position === 'absolute');

const itemsPerPart = (result: FitDeckResult, path = P): number[] =>
  result.positioned.slides.map((slide) => inFlow(boxAt(slide, path)).length);

const codes = (diagnostics: readonly Diagnostic[], code: Diagnostic['code']) => diagnostics.filter((d) => d.code === code);
const errors = (diagnostics: readonly Diagnostic[]) => diagnostics.filter((d) => d.severity === 'error');
const ofSlide = (diagnostics: readonly Diagnostic[], slide: number) => diagnostics.filter((d) => d.slide === slide);
const insideP = (path: string, p = P) => path.startsWith(`${p} > `);

// ───────────── 12 itens de 2 linhas ─────────────

describe('fitDeck — 12 two-line items in a <Box paginate>', () => {
  const at16x9 = lazy(() => fitAll([listSlide(twelveItems)], SIZE_16X9));
  const at4x3 = lazy(() => fitAll([listSlide(twelveItems)], SIZE_4X3));

  it('16x9 → 2 or 3 slides', () => {
    expect([2, 3]).toContain(at16x9().positioned.slides.length);
  });

  it('16x9 → the largest k per part (5, 5, 2)', () => {
    expect(itemsPerPart(at16x9())).toEqual([5, 5, 2]);
  });

  it('items across parts sum to 12, in order', () => {
    expect(itemsPerPart(at16x9()).reduce((a, b) => a + b, 0)).toBe(12);
    const order = at16x9().positioned.slides.flatMap((slide) => inFlow(boxAt(slide, P)).map((n) => n.path));
    expect(order).toEqual(Array.from({ length: 12 }, (_, i) => `${P} > Box[${i}]`));
  });

  it('children keep their original paths (Box[7] stays Box[7] in part 2)', () => {
    const part2 = at16x9().positioned.slides[1]!;
    const paths = inFlow(boxAt(part2, P)).map((n) => n.path);
    expect(paths).toContain(`${P} > Box[7]`);
    expect(paths[0]).toBe(`${P} > Box[5]`);
    expect(allNodes(part2).some((n) => n.path === `${P} > Box[7] > Text`)).toBe(true);
  });

  it('every part has the same title, slide path and sourceSlide', () => {
    const slides = at16x9().positioned.slides;
    for (const slide of slides) {
      const title = allNodes(slide).find((n) => n.path === TITLE);
      expect(title?.kind === 'text' ? title.content : undefined).toBe('Título da lista');
      expect(title?.frame).toEqual(allNodes(slides[0]!).find((n) => n.path === TITLE)?.frame);
      expect(slide.path).toBe('Slide');
      expect(slide.sourceSlide).toBe(1);
    }
  });

  it('every part has the same layout (P frame and first-item frame)', () => {
    const slides = at16x9().positioned.slides;
    const first = slides[0]!;
    for (const slide of slides) {
      expect(boxAt(slide, P).frame).toEqual(boxAt(first, P).frame);
      expect(inFlow(boxAt(slide, P))[0]!.frame).toEqual(inFlow(boxAt(first, P))[0]!.frame);
    }
  });

  it('absolute children of P appear in every part', () => {
    for (const slide of at16x9().positioned.slides) {
      expect(absolutes(boxAt(slide, P)).map((n) => n.path)).toEqual([`${P} > Shape`]);
    }
  });

  it('notes are in every part', () => {
    for (const slide of at16x9().positioned.slides) expect(slide.props.notes).toBe('Notas do apresentador');
  });

  it('no error diagnostic', () => {
    expect(errors(at16x9().diagnostics)).toEqual([]);
    expect(errors(at4x3().diagnostics)).toEqual([]);
  });

  it('only the first part has slide-continued, at P, with parts and sourceSlide', () => {
    const continued = codes(at16x9().diagnostics, 'slide-continued');
    expect(continued).toHaveLength(1);
    const [d] = continued;
    expect(d).toMatchObject({ severity: 'info', slide: 1, path: P, size: '16x9' });
    expect(d!.data?.parts).toBe(at16x9().positioned.slides.length);
    expect(d!.data?.sourceSlide).toBe(1);
  });

  it('slide-continued message counts the items per part', () => {
    const [d] = codes(at16x9().diagnostics, 'slide-continued');
    expect(d!.message).toContain('Slide 1 do autor virou 3 slides');
    expect(d!.message).toContain('5 de 12 itens no 1º');
    expect(d!.message).toContain('2 no 3º');
  });

  it('every diagnostic of a paginated part carries data.sourceSlide', () => {
    for (const d of at16x9().diagnostics) expect(d.data?.sourceSlide, d.code).toBe(1);
  });

  it('4x3 (taller) → fewer parts than 16x9', () => {
    expect(at4x3().positioned.slides.length).toBeLessThan(at16x9().positioned.slides.length);
    expect(itemsPerPart(at4x3())).toEqual([7, 5]);
  });

  it('positioned deck keeps the size', () => {
    expect(at16x9().positioned.size).toEqual(SIZE_16X9);
  });
});

// ───────────── shrink fora do Box paginate (medidor real) ─────────────

describe('fitDeck — texts inside P do not shrink while paginating', () => {
  const LONG_ITEM = 'Cada item desta lista tem texto suficiente para ocupar duas linhas inteiras na largura do slide padrão';
  // Com o medidor real, este título a 40 pt não cabe em 44 pt de altura e encolhe (~32 pt).
  const LONG_TITLE = 'Resultados consolidados do terceiro trimestre';
  const PR = 'Slide > Box[1]';
  const TITLE_PATH = 'Slide > Box[0] > Text';

  const slide = (count: number, paginate = true) => (
    <Slide padding={24} gap={16}>
      <Box height={44}>
        <Text size={40}>{LONG_TITLE}</Text>
      </Box>
      <Box paginate={paginate} grow={1} gap={12}>
        {Array.from({ length: count }, (_, i) => (
          <Box>
            <Text size={20}>{`${i + 1}. ${LONG_ITEM}`}</Text>
          </Box>
        ))}
      </Box>
    </Slide>
  );

  const result = lazy(() => fitAll([slide(12)], SIZE_16X9, realEnv));

  it('precondition: without paginate, the items shrink (fitSlide)', () => {
    const resolved = resolveAll([slide(6, false)], SIZE_16X9).slides[0]!;
    const plain = fitSlide({ slide: resolved, slideIndex: 0, size: SIZE_16X9, env: realEnv });
    expect(allMemberPaths(codes(plain.diagnostics, 'text-shrunk')).some((p) => insideP(p, PR))).toBe(true);
    expect(allMemberPaths(codes(plain.diagnostics, 'text-shrunk'))).toContain(TITLE_PATH);
  });

  it('paginates into more than one part', () => {
    expect(result().positioned.slides.length).toBeGreaterThan(1);
    expect(itemsPerPart(result(), PR).reduce((a, b) => a + b, 0)).toBe(12);
  });

  it('no text-shrunk (nor illegible) inside P', () => {
    const shrunk = result().diagnostics.filter((d) => d.code === 'text-shrunk' || d.code === 'text-illegible');
    expect(allMemberPaths(shrunk).filter((p) => insideP(p, PR))).toEqual([]);
  });

  it('items keep the author size in every part', () => {
    for (const part of result().positioned.slides) {
      const sizes = allNodes(part)
        .filter((n) => n.kind === 'text' && insideP(n.path, PR))
        .map((n) => (n.kind === 'text' ? n.text.fontSize : 0));
      expect(sizes.length).toBeGreaterThan(0);
      expect(new Set(sizes)).toEqual(new Set([20]));
    }
  });

  it('the title outside P still shrinks', () => {
    const shrunk = codes(result().diagnostics, 'text-shrunk');
    expect(shrunk.some((d) => memberPaths(d).includes(TITLE_PATH))).toBe(true);
  });

  it('no error diagnostic', () => {
    expect(errors(result().diagnostics)).toEqual([]);
  });
});

// ───────────── índices de slide ─────────────

describe('fitDeck — slide indices after a paginated slide', () => {
  // Imagem falsa 400×200 px (natural 300×150 pt) desenhada a 600×300 pt → image-upscaled (info).
  const upscaledSlide = (
    <Slide>
      <Image src="x.png" width={600} height={300} />
    </Slide>
  );
  const result = lazy(() => fitAll([upscaledSlide, listSlide(twelveItems), upscaledSlide], SIZE_16X9));

  it('precondition: the plain slide yields image-upscaled', () => {
    const plain = fitAll([upscaledSlide]);
    expect(codes(plain.diagnostics, 'image-upscaled')).toHaveLength(1);
  });

  it('output deck: 1 + 3 parts + 1 slides, sourceSlide [1, 2, 2, 2, 3]', () => {
    expect(result().positioned.slides.map((s) => s.sourceSlide)).toEqual([1, 2, 2, 2, 3]);
  });

  it('a slide before the pagination keeps its index and has no sourceSlide', () => {
    const first = ofSlide(result().diagnostics, 1);
    expect(codes(first, 'image-upscaled')).toHaveLength(1);
    for (const d of first) expect(d.data?.sourceSlide).toBeUndefined();
  });

  it('slide-continued is on output slide 2 with sourceSlide 2', () => {
    const [d] = codes(result().diagnostics, 'slide-continued');
    expect(d).toMatchObject({ slide: 2, path: P });
    expect(d!.data).toMatchObject({ sourceSlide: 2, parts: 3 });
    expect(d!.message).toContain('Slide 2 do autor virou 3 slides');
  });

  it('a slide after the pagination shifts (+2) and gains data.sourceSlide', () => {
    const last = codes(result().diagnostics, 'image-upscaled').filter((d) => d.slide !== 1);
    expect(last).toHaveLength(1);
    expect(last[0]!.slide).toBe(5);
    expect(last[0]!.data?.sourceSlide).toBe(3);
  });

  it('every diagnostic of the parts carries sourceSlide 2', () => {
    for (const d of result().diagnostics.filter((x) => x.slide >= 2 && x.slide <= 4)) expect(d.data?.sourceSlide).toBe(2);
  });

  it('two paginated slides: the second one shifts by the first one’s extra parts', () => {
    const r = fitAll([listSlide(twelveItems), listSlide(twelveItems)], SIZE_16X9);
    expect(r.positioned.slides.map((s) => s.sourceSlide)).toEqual([1, 1, 1, 2, 2, 2]);
    const continued = codes(r.diagnostics, 'slide-continued');
    expect(continued.map((d) => [d.slide, d.data?.sourceSlide, d.data?.parts])).toEqual([
      [1, 1, 3],
      [4, 2, 3],
    ]);
  });
});

// ───────────── nada cabe ─────────────

describe('fitDeck — not even the first item fits', () => {
  // 1º item com 30 linhas (600 pt) > área; os outros cabem, mas k seria 0.
  const result = lazy(() => fitAll([listSlide([30, 2, 2])], SIZE_16X9));

  it('stays a single slide with all items', () => {
    expect(result().positioned.slides).toHaveLength(1);
    expect(itemsPerPart(result())).toEqual([3]);
  });

  it('reports the normal text-overflow and no slide-continued', () => {
    expect(codes(result().diagnostics, 'slide-continued')).toEqual([]);
    const overflow = codes(result().diagnostics, 'text-overflow');
    expect(allMemberPaths(overflow).some((p) => insideP(p))).toBe(true);
  });

  it('diagnostics of an unpaginated first slide have no sourceSlide', () => {
    for (const d of result().diagnostics) expect(d.data?.sourceSlide).toBeUndefined();
  });

  it('shrink applies again inside P (same result as fitSlide)', () => {
    const resolved = resolveAll([listSlide([30, 2, 2])], SIZE_16X9).slides[0]!;
    const plain = fitSlide({ slide: resolved, slideIndex: 0, size: SIZE_16X9, env: createFakeEnv().env });
    expect(result().positioned.slides[0]).toEqual(plain.slide);
    expect(result().diagnostics).toEqual(plain.diagnostics);
  });
});

// ───────────── limite de partes ─────────────

describe('fitDeck — maxParts', () => {
  const max = DEFAULTS.paginate.maxParts;
  // Itens de 15 linhas (300 pt): um por parte em 16x9 (área 317). 15 itens > maxParts.
  const count = max + 5;
  const result = lazy(() => fitAll([listSlide(Array.from({ length: count }, () => 15))], SIZE_16X9));

  it(`stops at ${max} parts; the last one keeps the remaining items`, () => {
    expect(result().positioned.slides).toHaveLength(max);
    const perPart = itemsPerPart(result());
    expect(perPart.slice(0, max - 1)).toEqual(Array.from({ length: max - 1 }, () => 1));
    expect(perPart[max - 1]).toBe(count - (max - 1));
  });

  it('the last part has a box-overflow at P saying pagination stopped', () => {
    const last = ofSlide(result().diagnostics, max);
    const stop = last.filter((d) => d.code === 'box-overflow' && d.path === P);
    expect(stop).toHaveLength(1);
    expect(stop[0]!.severity).toBe('error');
    expect(stop[0]!.message).toContain(`A paginação parou em ${max} partes`);
    expect(stop[0]!.message.endsWith('divida o conteúdo em mais de um slide no deck.')).toBe(true);
  });

  it(`slide-continued reports ${max} parts`, () => {
    const [d] = codes(result().diagnostics, 'slide-continued');
    expect(d!.data?.parts).toBe(max);
  });

  it('no stop message before the last part', () => {
    const early = result().diagnostics.filter((d) => d.slide < max && d.message.includes('A paginação parou'));
    expect(early).toEqual([]);
  });
});

// ───────────── sem paginate ─────────────

describe('fitDeck — slides without paginate', () => {
  const slides = [
    <Slide padding={24}>
      <Box height={30}>
        <Text fit="error">{'a\nb\nc'}</Text>
      </Box>
    </Slide>,
    <Slide>
      <Text fit="truncate" maxLines={1}>{'x\ny'}</Text>
      <Image src="x.png" width={600} height={300} />
    </Slide>,
  ];

  it('equals fitSlide per slide (positioned and diagnostics)', () => {
    const { env } = createFakeEnv();
    const deck = resolveAll(slides, SIZE_16X9);
    const result = fitDeck({ deck, size: SIZE_16X9, env });
    const perSlide = deck.slides.map((slide, slideIndex) => fitSlide({ slide, slideIndex, size: SIZE_16X9, env }));
    expect(result.positioned.slides).toEqual(perSlide.map((r) => r.slide));
    expect(result.diagnostics).toEqual(perSlide.flatMap((r) => r.diagnostics));
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it('diagnostics have no sourceSlide', () => {
    for (const d of fitAll(slides).diagnostics) expect(d.data?.sourceSlide).toBeUndefined();
  });

  it('a paginate Box that fits → one slide, no slide-continued, same as fitSlide', () => {
    const { env } = createFakeEnv();
    const deck = resolveAll([listSlide([2, 2, 2])], SIZE_16X9);
    const result = fitDeck({ deck, size: SIZE_16X9, env });
    expect(result.positioned.slides).toHaveLength(1);
    expect(codes(result.diagnostics, 'slide-continued')).toEqual([]);
    expect(result.positioned.slides[0]).toEqual(fitSlide({ slide: deck.slides[0]!, slideIndex: 0, size: SIZE_16X9, env }).slide);
  });
});

// ───────────── ponta a ponta (render) ─────────────

describe('render — paginated slide end to end', () => {
  const ITEM = 'Cada item desta lista tem texto suficiente para ocupar duas linhas inteiras na largura do slide padrão';
  const deck = defineDeck(() => (
    <Deck>
      <Slide>
        <Text>Capa</Text>
      </Slide>
      <Slide padding={24} gap={16} notes="Notas da lista">
        <Text size={32}>Lista longa</Text>
        <Box paginate grow={1} gap={12}>
          {Array.from({ length: 12 }, (_, i) => (
            <Box>
              <Text size={20}>{`${i + 1}. ${ITEM}`}</Text>
            </Box>
          ))}
        </Box>
      </Slide>
    </Deck>
  ));

  const results = lazy(() => render(deck, { sizes: ['16x9', '4x3'], preview: { mode: 'native', width: 320 }, includePositioned: true }));

  it('the pptx, positioned deck and previews are numbered by the output deck', async () => {
    for (const result of await results()) {
      const positioned = result.positioned!;
      const parts = positioned.slides.length - 1;
      expect(parts).toBeGreaterThan(1);
      const zip = await JSZip.loadAsync(result.buffer);
      const slideFiles = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
      expect(slideFiles).toHaveLength(positioned.slides.length);
      expect(result.preview?.slides).toHaveLength(positioned.slides.length);
      // O emissor cria um notesSlide por slide; conta os que carregam as notas da lista.
      const notesFiles = Object.keys(zip.files).filter((f) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(f));
      const contents = await Promise.all(notesFiles.map((f) => zip.file(f)!.async('string')));
      expect(contents.filter((c) => c.includes('Notas da lista'))).toHaveLength(parts);
    }
  }, 120_000);

  it('no error; slide-continued on output slide 2; 4x3 has no more parts than 16x9', async () => {
    const [wide, standard] = await results();
    for (const result of [wide!, standard!]) {
      expect(errors(result.diagnostics)).toEqual([]);
      const [continued] = codes(result.diagnostics, 'slide-continued');
      expect(continued).toMatchObject({ slide: 2, data: { sourceSlide: 2 } });
    }
    expect(standard!.positioned!.slides.length).toBeLessThanOrEqual(wide!.positioned!.slides.length);
  }, 120_000);
});

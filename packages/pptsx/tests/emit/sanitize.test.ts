import { describe, expect, it } from 'vitest';
import { tmpdir } from 'node:os';
import JSZip from 'jszip';
import { emitPptx } from '../../src/emit/index.ts';
import {
  keepFirstParagraphProps,
  keepFirstPropsOfBody,
  paragraphsOf as sanitizeParagraphsOf,
  sanitizeParagraph,
} from '../../src/emit/sanitize.ts';
import { fakeParagraphLayout, pDeck, pSlide, pText, rect } from '../helpers/nodes.ts';

const PPR = /<a:pPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:pPr>)/g;
const paragraphsOf = (xml: string): string[] => xml.match(/<a:p>[\s\S]*?<\/a:p>/g) ?? [];
const pPrCount = (p: string): number => (p.match(PPR) ?? []).length;

const run = (t: string) => `<a:r><a:rPr lang="pt-BR"/><a:t>${t}</a:t></a:r>`;
const SELF_CLOSING = '<a:pPr algn="l" indent="0"/>';
const WITH_CHILDREN = '<a:pPr algn="l"><a:lnSpc><a:spcPct val="100000"/></a:lnSpc></a:pPr>';

describe('keepFirstParagraphProps', () => {
  it('keeps only the first self-closing <a:pPr> of an <a:p>', () => {
    const xml = `<a:p>${SELF_CLOSING}${run('a')}<a:br/>${SELF_CLOSING}${run('b')}</a:p>`;
    expect(keepFirstParagraphProps(xml)).toBe(`<a:p>${SELF_CLOSING}${run('a')}<a:br/>${run('b')}</a:p>`);
  });

  it('keeps only the first <a:pPr> with children', () => {
    const xml = `<a:p>${WITH_CHILDREN}${run('a')}<a:br/>${WITH_CHILDREN}${run('b')}<a:br/>${WITH_CHILDREN}${run('c')}</a:p>`;
    expect(keepFirstParagraphProps(xml)).toBe(
      `<a:p>${WITH_CHILDREN}${run('a')}<a:br/>${run('b')}<a:br/>${run('c')}</a:p>`,
    );
  });

  it('leaves a paragraph with a single <a:pPr> untouched', () => {
    const xml = `<a:p>${WITH_CHILDREN}${run('only')}</a:p>`;
    expect(keepFirstParagraphProps(xml)).toBe(xml);
  });

  it('leaves a paragraph without <a:pPr> untouched', () => {
    const xml = `<a:p>${run('x')}</a:p>`;
    expect(keepFirstParagraphProps(xml)).toBe(xml);
  });

  it('works per paragraph: each <a:p> keeps its own first <a:pPr>', () => {
    const p1 = `<a:p>${SELF_CLOSING}${run('a')}<a:br/>${SELF_CLOSING}${run('b')}</a:p>`;
    const p2 = `<a:p>${WITH_CHILDREN}${run('c')}<a:br/>${WITH_CHILDREN}${run('d')}</a:p>`;
    const out = keepFirstParagraphProps(`<p:txBody>${p1}${p2}</p:txBody>`);
    const ps = paragraphsOf(out);
    expect(ps).toHaveLength(2);
    expect(ps.map(pPrCount)).toEqual([1, 1]);
    expect(ps[0]).toContain(SELF_CLOSING);
    expect(ps[1]).toContain(WITH_CHILDREN);
  });

  it('preserves <a:br/> and every run, in order', () => {
    const xml = `<a:p>${SELF_CLOSING}${run('a')}<a:br/>${SELF_CLOSING}${run('b')}<a:br/>${SELF_CLOSING}${run('c')}</a:p>`;
    const out = keepFirstParagraphProps(xml);
    expect(out.match(/<a:br\/>/g)).toHaveLength(2);
    expect([...out.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1])).toEqual(['a', 'b', 'c']);
    expect(out.match(/<a:rPr lang="pt-BR"\/>/g)).toHaveLength(3);
  });

  it('does not touch content outside <a:p>', () => {
    const outside = '<a:bodyPr wrap="square"/><a:lstStyle/>';
    const xml = `${outside}<a:p>${SELF_CLOSING}${run('a')}<a:br/>${SELF_CLOSING}${run('b')}</a:p>`;
    expect(keepFirstParagraphProps(xml).startsWith(outside)).toBe(true);
  });
});

describe('emitPptx — at most one <a:pPr> per <a:p>', () => {
  it('multi-line, multi-paragraph text', async () => {
    const text = fakeParagraphLayout([
      ['primeira linha', 'segunda linha', 'terceira'],
      ['outro parágrafo', 'com duas'],
      ['único'],
    ]);
    const node = pText(rect(10, 10, 300, 200), 'ignored', { lineHeight: 1.2, align: 'center' }, text);
    const buffer = await emitPptx(pDeck([pSlide([node])]), { baseDir: tmpdir() });
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
    const ps = paragraphsOf(xml);
    expect(ps).toHaveLength(3);
    for (const p of ps) expect(pPrCount(p)).toBeLessThanOrEqual(1);
    expect(ps.map((p) => (p.match(/<a:br\b[^>]*\/>/g) ?? []).length)).toEqual([2, 1, 0]);
  });
});

// ───────────── propriedade (M7-D): gerador próprio com seed fixa ─────────────

/** mulberry32: PRNG pequeno e determinístico; a mesma seed reproduz os mesmos casos. */
const prng = (seed: number) => {
  let state = seed >>> 0;
  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

type Random = () => number;
const intBetween = (random: Random, min: number, max: number): number => min + Math.floor(random() * (max - min + 1));
const pick = <T>(random: Random, items: readonly T[]): T => items[intBetween(random, 0, items.length - 1)]!;

const TEXT_PIECES = ['a', 'b', 'linha', 'ção', 'é', ' ', '  ', 'x/y', 'bem-', '&amp;', '&lt;', '…', '1', 'Z'] as const;
const PPR_VARIANTS = [
  '<a:pPr/>',
  '<a:pPr algn="l"/>',
  '<a:pPr algn="ctr" indent="0" marL="0"/>',
  '<a:pPr algn="l"><a:lnSpc><a:spcPct val="100000"/></a:lnSpc></a:pPr>',
  '<a:pPr algn="r"><a:lnSpc><a:spcPts val="2160"/></a:lnSpc><a:buNone/></a:pPr>',
] as const;
const RPR_VARIANTS = ['<a:rPr/>', '<a:rPr lang="pt-BR"/>', '<a:rPr lang="pt-BR" sz="1800" b="1" dirty="0"/>'] as const;

interface GeneratedParagraph {
  readonly xml: string;
  readonly texts: readonly string[];
  readonly firstProps: string;
  readonly breaks: number;
}

const genText = (random: Random): string =>
  Array.from({ length: intBetween(random, 0, 4) }, () => pick(random, TEXT_PIECES)).join('');

/** Corpo como o pptxgenjs gera (pPr antes de cada run, inclusive depois de <a:br/>), com repetições aleatórias. */
const genParagraph = (random: Random): GeneratedParagraph => {
  const firstProps = pick(random, PPR_VARIANTS);
  const parts: string[] = [firstProps];
  const texts: string[] = [];
  let breaks = 0;
  const items = intBetween(random, 1, 8);
  for (let i = 0; i < items; i += 1) {
    const roll = random();
    if (roll < 0.25) {
      parts.push('<a:br/>');
      breaks += 1;
    } else if (roll < 0.5) {
      parts.push(pick(random, PPR_VARIANTS));
    } else {
      const text = genText(random);
      texts.push(text);
      parts.push(`<a:r>${pick(random, RPR_VARIANTS)}<a:t>${text}</a:t></a:r>`);
    }
  }
  if (random() < 0.3) parts.push('<a:endParaRPr lang="pt-BR"/>');
  return { xml: `<a:p>${parts.join('')}</a:p>`, texts, firstProps, breaks };
};

interface GeneratedSlide {
  readonly xml: string;
  readonly paragraphs: readonly GeneratedParagraph[];
}

const BODY_OPEN = '<p:txBody><a:bodyPr wrap="square" lIns="0"/><a:lstStyle/>';
const BODY_CLOSE = '</p:txBody>';

const genSlide = (random: Random): GeneratedSlide => {
  const shapes = Array.from({ length: intBetween(random, 1, 3) }, () =>
    Array.from({ length: intBetween(random, 1, 4) }, () => genParagraph(random)),
  );
  const xml = `<p:spTree>${shapes
    .map((ps) => `<p:sp>${BODY_OPEN}${ps.map((p) => p.xml).join('')}${BODY_CLOSE}</p:sp>`)
    .join('')}</p:spTree>`;
  return { xml, paragraphs: shapes.flat() };
};

const PPR_ALL = /<a:pPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:pPr>)/g;
const pPrOf = (p: string): string[] => p.match(PPR_ALL) ?? [];
const textsOf = (xml: string): string[] => [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]!);
const brTotal = (xml: string): number => (xml.match(/<a:br\/>/g) ?? []).length;

/**
 * Balanceador próprio: toda tag aberta fecha na ordem certa, nada sobra aberto e
 * não há '<' ou '>' soltos no texto. Basta para o XML que o gerador produz.
 */
const isWellFormed = (xml: string): boolean => {
  const stack: string[] = [];
  const TAG = /<(\/?)([A-Za-z_][\w.:-]*)((?:\s+[\w:.-]+="[^"<>]*")*)\s*(\/?)>/y;
  let index = 0;
  while (index < xml.length) {
    const next = xml.indexOf('<', index);
    const text = xml.slice(index, next === -1 ? xml.length : next);
    if (text.includes('>')) return false;
    if (next === -1) break;
    TAG.lastIndex = next;
    const match = TAG.exec(xml);
    if (!match) return false;
    const [whole, closing, name, , selfClosing] = match;
    if (closing && selfClosing) return false;
    if (closing && stack.pop() !== name) return false;
    if (!closing && !selfClosing) stack.push(name!);
    index = next + whole.length;
  }
  return stack.length === 0;
};

const SEED = 0x5eed_7;
const CASES = 200;
const cases = (() => {
  const random = prng(SEED);
  return Array.from({ length: CASES }, () => genSlide(random));
})();

describe('isWellFormed (balanceador do teste)', () => {
  it.each([
    ['<a/>', true],
    ['<a><b x="1"/>t</a>', true],
    ['<a><b></a></b>', false],
    ['<a>', false],
    ['</a>', false],
    ['<a>x > y</a>', false],
    ['<a:p><a:pPr algn="l"/></a:p>', true],
  ])('%s → %s', (xml, expected) => {
    expect(isWellFormed(xml)).toBe(expected);
  });

  it('generated inputs are well formed (sanity of the generator)', () => {
    for (const { xml } of cases) expect(isWellFormed(xml), xml).toBe(true);
  });
});

describe(`sanitize — property (${CASES} cases, seed ${SEED})`, () => {
  it('generator covers repeated <a:pPr>, <a:br/> and multi-paragraph bodies', () => {
    const all = cases.flatMap((c) => c.paragraphs);
    expect(all.some((p) => pPrOf(p.xml).length > 2)).toBe(true);
    expect(all.some((p) => p.breaks > 0)).toBe(true);
    expect(cases.some((c) => c.paragraphs.length > 3)).toBe(true);
  });

  it('paragraphsOf finds every generated <a:p>, in order', () => {
    for (const { xml, paragraphs } of cases) expect(sanitizeParagraphsOf(xml)).toEqual(paragraphs.map((p) => p.xml));
  });

  it('exactly one <a:pPr> per <a:p>, and it is the first one of the input', () => {
    for (const { xml, paragraphs } of cases) {
      const out = sanitizeParagraphsOf(keepFirstParagraphProps(xml));
      expect(out).toHaveLength(paragraphs.length);
      out.forEach((p, i) => {
        expect(pPrOf(p), p).toEqual([paragraphs[i]!.firstProps]);
        // pPr continua sendo o primeiro filho de <a:p> (exigência do schema).
        expect(p.startsWith(`<a:p>${paragraphs[i]!.firstProps}`), p).toBe(true);
      });
    }
  });

  it('every <a:t> and <a:br/> is preserved, in order', () => {
    for (const { xml, paragraphs } of cases) {
      const out = keepFirstParagraphProps(xml);
      expect(textsOf(out)).toEqual(paragraphs.flatMap((p) => p.texts));
      expect(brTotal(out)).toBe(paragraphs.reduce((sum, p) => sum + p.breaks, 0));
    }
  });

  it('removing every <a:pPr> from input and output yields the same XML (only pPr is touched)', () => {
    for (const { xml } of cases) expect(keepFirstParagraphProps(xml).replace(PPR_ALL, '')).toBe(xml.replace(PPR_ALL, ''));
  });

  it('output stays well formed', () => {
    for (const { xml } of cases) {
      const out = keepFirstParagraphProps(xml);
      expect(isWellFormed(out), out).toBe(true);
    }
  });

  it('is idempotent', () => {
    for (const { xml } of cases) {
      const once = keepFirstParagraphProps(xml);
      expect(keepFirstParagraphProps(once)).toBe(once);
    }
  });

  it('sanitizeParagraph and keepFirstPropsOfBody agree with the whole-document pass', () => {
    for (const { xml } of cases) {
      const expected = sanitizeParagraphsOf(keepFirstParagraphProps(xml));
      const paragraphs = sanitizeParagraphsOf(xml);
      expect(paragraphs.map(sanitizeParagraph)).toEqual(expected);
      const bodies = paragraphs.map((p) => p.slice('<a:p>'.length, -'</a:p>'.length));
      expect(bodies.map((body) => `<a:p>${keepFirstPropsOfBody(body)}</a:p>`)).toEqual(expected);
    }
  });
});

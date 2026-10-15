import { describe, expect, it } from 'vitest';
import { Deck, Text, createContext, resolveDeck, resolveSize, type ResolvedBox, type ResolvedNode, type ResolvedShape, type ResolvedSlide, type ResolvedText, type SlideElement } from 'pptsx';
import { ClosingLayout, ContentLayout, CoverLayout, tokens } from '@pptsx/ds-base';

/** M9: resolveDeck exige ctx; estes testes não usam props responsivas, então 16x9 basta. */
const RESOLVE_CTX = createContext(resolveSize('16x9'));

/** Layouts de exemplo (contrato M5, versão polida): ctx no círculo, caption, justify. */

const resolveSlide = (slide: SlideElement): ResolvedSlide => resolveDeck(<Deck>{slide}</Deck>, RESOLVE_CTX).slides[0]!;

const descendants = (nodes: readonly ResolvedNode[]): ResolvedNode[] =>
  nodes.flatMap((node) => [node, ...('children' in node ? descendants(node.children) : [])]);
const texts = (slide: ResolvedSlide) => descendants(slide.children).filter((n): n is ResolvedText => n.kind === 'text');
const ellipse = (slide: ResolvedSlide) =>
  descendants(slide.children).find((n): n is ResolvedShape => n.kind === 'shape' && n.props.kind === 'ellipse')!;

const CTX_4X3 = createContext(resolveSize('4x3'));
const CTX_16X9 = createContext(resolveSize('16x9'));

describe('CoverLayout', () => {
  it('circle diameter = 0.9 × ctx.height, with equal width and height', () => {
    for (const ctx of [CTX_16X9, CTX_4X3]) {
      const { css } = ellipse(resolveSlide(<CoverLayout title="T" ctx={ctx} />));
      expect(css.width).toBeCloseTo(0.9 * ctx.height);
      expect(css.height).toBe(css.width);
      expect(css.position).toBe('absolute');
    }
  });

  it('without ctx uses the 16:9 height (405 pt)', () => {
    expect(ellipse(resolveSlide(<CoverLayout title="T" />)).css.width).toBeCloseTo(0.9 * 405);
  });

  it('caption is an optional small text before the title', () => {
    const withCaption = texts(resolveSlide(<CoverLayout title="Título" caption="Q3 · 2026" />));
    expect(withCaption.map((t) => t.content)).toEqual(['Q3 · 2026', 'Título']);
    expect(withCaption[0]!.props.size).toBe(tokens.font.small);
    expect(texts(resolveSlide(<CoverLayout title="Título" />)).map((t) => t.content)).toEqual(['Título']);
  });

  it('title is display bold white, shrink with minSize 32; subtitle truncates at 2 lines', () => {
    const [title, subtitle] = texts(resolveSlide(<CoverLayout title="T" subtitle="S" />));
    expect(title!.props).toMatchObject({ size: tokens.font.display, weight: 'bold', minSize: 32 });
    expect(title!.props.fit ?? 'shrink').toBe('shrink');
    expect(subtitle!.props).toMatchObject({ size: tokens.font.h2, fit: 'truncate', maxLines: 2 });
  });
});

describe('ContentLayout', () => {
  const body = (slide: ResolvedSlide) => slide.children[1] as ResolvedBox;

  it("body is a growing box with justify 'start' by default", () => {
    const slide = resolveSlide(<ContentLayout title="T"><Text>x</Text></ContentLayout>);
    expect(body(slide).css.flexGrow).toBe(1);
    expect(body(slide).css.justifyContent).toBe('flex-start');
  });

  it("justify='center' is forwarded to the body", () => {
    const slide = resolveSlide(<ContentLayout title="T" justify="center"><Text>x</Text></ContentLayout>);
    expect(body(slide).css.justifyContent).toBe('center');
  });
});

describe('ClosingLayout', () => {
  it('circle diameter = 0.75 × ctx.height (16:9 height without ctx)', () => {
    expect(ellipse(resolveSlide(<ClosingLayout title="T" ctx={CTX_4X3} />)).css.width).toBeCloseTo(0.75 * CTX_4X3.height);
    expect(ellipse(resolveSlide(<ClosingLayout title="T" />)).css.width).toBeCloseTo(0.75 * 405);
  });

  it('renders title, subtitle and contact texts', () => {
    const contents = texts(resolveSlide(<ClosingLayout title="Obrigado" subtitle="Sub" contact="a@b.c" />)).map((t) => t.content);
    expect(contents).toEqual(expect.arrayContaining(['Obrigado', 'Sub', 'a@b.c']));
  });
});

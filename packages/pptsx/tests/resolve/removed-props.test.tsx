import { describe, expect, it } from 'vitest';
import type { CssStyle, ResolvedNode, SlideElement } from '../../src/core/types.ts';
import { B, Box, Deck, I, Image, Shape, Slide, Span, Text } from '../../src/primitives/index.ts';
import { initialCss, resolveDeck, ResolveError } from '../../src/resolve/index.ts';
import { ALIAS_RULES } from '../../src/resolve/removed-props.ts';
import { createContext, resolveSize } from '../../src/sizes.ts';
import { cssOf, legacyCssOf } from '../helpers/css.ts';

/**
 * M18-6: as props da 0.x saíram na 1.0 — cada uma vira ResolveError com a troca e o comando que migra.
 * Também confere que o `css` montado pelos helpers dos testes (tests/helpers/css.ts, que ainda falam a
 * língua interna da engine) é o que o resolve produz para as props CSS equivalentes.
 */

const CTX = createContext(resolveSize('16x9'));

// Os elementos abaixo usam de propósito props que o tipo não aceita mais.
const loose = (component: unknown, props: Readonly<Record<string, unknown>>, children?: unknown): SlideElement =>
  ({ type: component, props: { ...props, ...(children === undefined ? {} : { children }) } }) as unknown as SlideElement;

const resolveOne = (el: SlideElement) => resolveDeck(<Deck><Slide>{el}</Slide></Deck>, CTX);

const errorOf = (el: SlideElement): ResolveError => {
  try {
    resolveOne(el);
  } catch (error) {
    if (error instanceof ResolveError) return error;
    throw error;
  }
  throw new Error('não lançou');
};

const nodeOf = (el: SlideElement): ResolvedNode => {
  const node = resolveOne(el).slides[0]?.children[0];
  if (node === undefined) throw new Error('no node');
  return node;
};

const cssOfElement = (el: SlideElement): CssStyle => nodeOf(el).css;

describe('props da 0.x: ResolveError com a troca', () => {
  it.each([
    [Box, { direction: 'row' }, 'display="flex"'],
    [Box, { align: 'center' }, 'alignItems="center"'],
    [Box, { justify: 'between' }, 'justifyContent="space-between"'],
    [Box, { grow: 1 }, 'flex={1}'],
    [Box, { grow: 0 }, 'flexGrow={0}'],
    [Box, { shrink: 0 }, 'flexShrink'],
    [Box, { fill: '#EEEEEE' }, 'backgroundColor'],
    [Box, { stroke: '#000000' }, 'outline='],
    [Box, { radius: 8 }, 'borderRadius'],
    [Image, { src: 'x.png', fit: 'cover' }, 'objectFit'],
  ] as const)('<%o %o>', (component, props, suggestion) => {
    const error = errorOf(loose(component, props));
    expect(error.removedProp).toBe(true);
    expect(error.message).toContain(`Prop "${Object.keys(props).find((key) => key !== 'src')}"`);
    expect(error.message).toContain('removida na 1.0');
    expect(error.message).toContain(suggestion);
    expect(error.message).toContain('pptsx lint --fix');
  });

  it.each([
    [{ size: 20 }, 'fontSize'],
    [{ font: 'Arial' }, 'fontFamily'],
    [{ weight: 'bold' }, 'fontWeight'],
    [{ italic: true }, 'fontStyle="italic"'],
    [{ align: 'center' }, 'textAlign'],
  ] as const)('<Text %o>', (props, suggestion) => {
    const error = errorOf(loose(Text, props, 'x'));
    expect(error.removedProp).toBe(true);
    expect(error.message).toContain(suggestion);
  });

  it('Slide: direction e background={{ image }}', () => {
    const direction = (() => {
      try {
        resolveDeck(<Deck>{loose(Slide, { direction: 'row' })}</Deck>, CTX);
      } catch (error) {
        return error as ResolveError;
      }
      throw new Error('não lançou');
    })();
    expect(direction.message).toContain('flexDirection');
    expect(() => resolveDeck(<Deck>{loose(Slide, { background: { image: 'bg.png' } })}</Deck>, CTX)).toThrow('backgroundImage="url(bg.png)"');
    expect(() => resolveDeck(<Deck>{loose(Slide, { background: './bg.png' })}</Deck>, CTX)).toThrow('backgroundImage="url(./bg.png)"');
  });

  it('Span: weight/italic; B e I usam fontWeight/fontStyle', () => {
    expect(errorOf(<Text>a {loose(Span, { weight: 'bold' }, 'b')}</Text>).message).toContain('fontWeight');
    const node = nodeOf(<Text><B>a</B><I>b</I></Text>);
    expect(node.kind === 'text' ? node.runs?.map((run) => [run.weight, run.italic]) : undefined).toEqual([['bold', false], ['regular', true]]);
  });

  it('o que é da primitiva continua: fill/stroke/radius do Shape, background CSS em cor, fit do Text', () => {
    expect(() => resolveOne(<Shape kind="rect" width={10} height={10} fill="#FF0000" stroke="#000000" strokeWidth={2} radius={4} />)).not.toThrow();
    expect(() => resolveDeck(<Deck><Slide background="#112233" /></Deck>, CTX)).not.toThrow();
    expect(() => resolveOne(<Text fit="shrink">x</Text>)).not.toThrow();
  });

  it('toda regra da tabela tem pelo menos uma primitiva', () => {
    expect(ALIAS_RULES.every((rule) => rule.kinds.length > 0)).toBe(true);
  });
});

describe('tests/helpers/css.ts matches the resolve', () => {
  it('cssOf() is initialCss()', () => {
    expect(cssOf()).toEqual(initialCss());
  });

  it.each([
    [
      'box with container and paint props',
      'box',
      { direction: 'row', gap: 10, padding: { top: 5, left: 3 }, align: 'center', justify: 'between', fill: '#EEEEEE', stroke: '#000000', strokeWidth: 2, radius: 8 },
      <Box display="flex" gap={10} padding={{ top: 5, left: 3 }} alignItems="center" justifyContent="space-between" backgroundColor="#EEEEEE" outline="2px solid #000000" borderRadius={8} />,
    ],
    [
      'box as flex item',
      'box',
      { grow: 1, shrink: 0, alignSelf: 'end', width: 100, height: '50%', minWidth: 10, maxHeight: 200 },
      <Box flex={1} flexShrink={0} alignSelf="flex-end" width={100} height="50%" minWidth={10} maxHeight={200} />,
    ],
    ['absolute box', 'box', { position: 'absolute', top: 10, left: 20, right: 0, bottom: '10%' }, <Box position="absolute" top={10} left={20} right={0} bottom="10%" />],
    ['text', 'text', { grow: 2, width: 300, position: 'relative', top: 4 }, <Text flex={2} width={300} position="relative" top={4}>x</Text>],
    ['shape keeps its own fill', 'shape', { kind: 'ellipse', fill: '#FF0000', width: 20, height: 20 }, <Shape kind="ellipse" fill="#FF0000" width={20} height={20} />],
    ['image', 'image', { src: 'x.png', width: 100 }, <Image src="x.png" width={100} />],
  ] as const)('%s', (_name, kind, props, el) => {
    expect(legacyCssOf(kind, props)).toEqual(cssOfElement(el));
  });

  it('slide with padding, gap and background', () => {
    const slide = resolveDeck(<Deck><Slide flexDirection="row" gap={6} padding={12} background="#112233" /></Deck>, CTX).slides[0]!;
    expect(legacyCssOf('slide', { direction: 'row', gap: 6, padding: 12, background: '#112233' })).toEqual(slide.css);
  });
});

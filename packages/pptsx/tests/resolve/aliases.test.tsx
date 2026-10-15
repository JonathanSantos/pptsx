import { describe, expect, it } from 'vitest';
import type { CssStyle, ResolvedNode, SlideElement } from '../../src/core/types.ts';
import { Box, Deck, Image, Shape, Slide, Text } from '../../src/primitives/index.ts';
import { initialCss, resolveDeck } from '../../src/resolve/index.ts';
import { createContext, resolveSize } from '../../src/sizes.ts';
import { cssOf, legacyCssOf } from '../helpers/css.ts';

/**
 * M11: props antigas são alias do CSS (CONTRACTS §M11 "Aliases antigos") e resolvem para o
 * mesmo `css`. Também confere que o `css` montado pelos helpers dos testes (tests/helpers/css.ts)
 * é o que o resolve real produziria para as mesmas props.
 */

const CTX = createContext(resolveSize('16x9'));

const nodeOf = (el: SlideElement): ResolvedNode => {
  const node = resolveDeck(<Deck><Slide>{el}</Slide></Deck>, CTX).slides[0]?.children[0];
  if (node === undefined) throw new Error('no node');
  return node;
};

const cssOfElement = (el: SlideElement): CssStyle => nodeOf(el).css;

describe('legacy props resolve to the same css', () => {
  it('direction/fill/radius ≡ display flex/backgroundColor/borderRadius', () => {
    expect(cssOfElement(<Box direction="row" fill="#eeeeee" radius={8} />)).toEqual(
      cssOfElement(<Box display="flex" backgroundColor="#eeeeee" borderRadius={8} />),
    );
  });

  it('align/justify ≡ alignItems/justifyContent', () => {
    expect(cssOfElement(<Box align="center" justify="between" />)).toEqual(
      cssOfElement(<Box alignItems="center" justifyContent="space-between" />),
    );
  });

  it('stroke/strokeWidth become an outline that takes no space', () => {
    expect(cssOfElement(<Box stroke="#000000" strokeWidth={2} />)).toMatchObject({
      outline: { color: '#000000', width: 2 },
      border: { top: { width: 0 }, right: { width: 0 }, bottom: { width: 0 }, left: { width: 0 } },
    });
  });

  it('Text font/size/weight/italic/align ≡ fontFamily/fontSize/fontWeight/fontStyle/textAlign', () => {
    const legacy = nodeOf(<Text font="Arial" size={20} weight="bold" italic align="center">x</Text>);
    const css = nodeOf(<Text fontFamily="Arial" fontSize={20} fontWeight="bold" fontStyle="italic" textAlign="center">x</Text>);
    expect(legacy.css).toEqual(css.css);
    expect(legacy.props).toEqual(css.props);
  });
});

describe('tests/helpers/css.ts matches the resolve', () => {
  it('cssOf() is initialCss()', () => {
    expect(cssOf()).toEqual(initialCss());
  });

  it.each([
    ['box with container and paint props', 'box', { direction: 'row', gap: 10, padding: { top: 5, left: 3 }, align: 'center', justify: 'between', fill: '#EEEEEE', stroke: '#000000', strokeWidth: 2, radius: 8 }],
    ['box as flex item', 'box', { grow: 1, shrink: 0, alignSelf: 'end', width: 100, height: '50%', minWidth: 10, maxHeight: 200 }],
    ['absolute box', 'box', { position: 'absolute', top: 10, left: 20, right: 0, bottom: '10%' }],
    ['text', 'text', { grow: 2, width: 300, position: 'relative', top: 4 }],
    ['shape keeps its own fill', 'shape', { kind: 'ellipse', fill: '#FF0000', width: 20, height: 20 }],
    ['image', 'image', { src: 'x.png', width: 100 }],
  ] as const)('%s', (_name, kind, props) => {
    const el =
      kind === 'box' ? <Box {...props} /> : kind === 'text' ? <Text {...props}>x</Text> : kind === 'shape' ? <Shape {...props} /> : <Image {...props} />;
    expect(legacyCssOf(kind, props)).toEqual(cssOfElement(el));
  });

  it('slide with padding, gap and background', () => {
    const props = { direction: 'row', gap: 6, padding: 12, background: '#112233' } as const;
    const slide = resolveDeck(<Deck><Slide {...props} /></Deck>, CTX).slides[0]!;
    expect(legacyCssOf('slide', props)).toEqual(slide.css);
  });
});

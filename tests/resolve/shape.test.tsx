import { describe, expect, it } from 'vitest';
import { resolveDeck, ResolveError } from '../../src/resolve/index.ts';
import { createContext, resolveSize } from '../../src/sizes.ts';
import { Box, Deck, Shape, Slide } from '../../src/primitives/index.ts';
import type { SlideElement } from '../../src/core/types.ts';

const ctx = createContext(resolveSize('16x9'));
const resolve = (node: unknown) => resolveDeck((<Deck><Slide>{node as SlideElement}</Slide></Deck>) as SlideElement, ctx);

describe('M12-2 — validação de formas', () => {
  it('aceita as kinds novas e guarda flip/traço/setas nas props', () => {
    const deck = resolve(<Shape kind="line" width={10} height={0} flipH lineStyle="dashed" lineCap="round" startArrow="oval" endArrow="stealth" />);
    expect(deck.slides[0]!.children[0]!.props).toMatchObject({ kind: 'line', flipH: true, lineStyle: 'dashed', lineCap: 'round', startArrow: 'oval', endArrow: 'stealth' });
  });

  it('kind desconhecido → ResolveError com a lista', () => {
    expect(() => resolve(<Shape kind={'blob' as never} width={10} height={10} />)).toThrow(/kind "blob" inválido; use "rect"/);
  });

  it('setas fora de line → ResolveError', () => {
    expect(() => resolve(<Shape kind="rect" width={10} height={10} endArrow="triangle" />)).toThrow(ResolveError);
    expect(() => resolve(<Shape kind="rect" width={10} height={10} endArrow="none" />)).not.toThrow();
  });

  it('lineStyle inválido → ResolveError', () => {
    expect(() => resolve(<Shape kind="rect" width={10} height={10} lineStyle={'wavy' as never} />)).toThrow(/lineStyle "wavy"/);
  });

  it('Box shape: aceita kinds de área, recusa line e desconhecidas', () => {
    expect(resolve(<Box shape="diamond" width={10} height={10} />).slides[0]!.children[0]!.props).toMatchObject({ shape: 'diamond' });
    expect(() => resolve(<Box shape="line" width={10} height={10} />)).toThrow(/Box shape="line"/);
    expect(() => resolve(<Box shape={'blob' as never} width={10} height={10} />)).toThrow(/shape "blob"/);
  });

  it('id: string não vazia', () => {
    expect(resolve(<Box id="a" width={10} height={10} />).slides[0]!.children[0]!.props).toMatchObject({ id: 'a' });
    expect(() => resolve(<Box id={'' as never} width={10} height={10} />)).toThrow(/Prop "id"/);
  });
});

import { describe, expect, it } from 'vitest';
import type { PositionedSlide } from '../../src/core/types.ts';
import { layoutSlide } from '../../src/layout/index.ts';
import { Box, Deck, Image, Shape, Slide, Text } from '../../src/primitives/index.ts';
import { resolveDeck } from '../../src/resolve/index.ts';
import { createContext, resolveSize } from '../../src/sizes.ts';
import { SIZE_16X9, createFakeEnv, rect } from '../helpers/nodes.ts';
import { child, expectFrame, frameTree } from '../helpers/positioned.ts';

/** M9: resolveDeck exige ctx; estes testes não usam props responsivas, então 16x9 basta. */
const RESOLVE_CTX = createContext(resolveSize('16x9'));

const Title = ({ children }: { children: string }) => (
  <Text size={40} weight="bold">
    {children}
  </Text>
);

const Card = ({ label }: { label: string }) => (
  <Box grow={1} padding={10} gap={5} fill="#eeeeee">
    <Text size={14}>{label}</Text>
    <Shape kind="rect" width={40} height={4} fill="#3366cc" />
  </Box>
);

const deck = (
  <Deck>
    <Slide padding={36} gap={16} background="#ffffff">
      <Shape kind="rect" position="absolute" left={0} top={0} width="100%" height={8} fill="#3366cc" />
      <Title>Quarterly review</Title>
      <Box direction="row" gap={20} grow={1}>
        <Card label="Revenue" />
        <Card label="Costs" />
        <Card label="Margin" />
      </Box>
      <Box direction="row" justify="between" align="center" height={30}>
        <Image src="logo.png" height={30} />
        <Text size={12}>Page 1</Text>
      </Box>
    </Slide>
  </Deck>
);

const laidOut = (): PositionedSlide => {
  const slide = resolveDeck(deck, RESOLVE_CTX).slides[0];
  if (!slide) throw new Error('no slide');
  return layoutSlide(slide, SIZE_16X9, createFakeEnv().env);
};

describe('layout — composed JSX slide', () => {
  it('matches the positioned-tree snapshot', () => {
    expect(frameTree(laidOut())).toMatchSnapshot();
  });

  it('places the absolute top bar across the whole slide, ignoring slide padding', () => {
    expectFrame(child(laidOut(), 0).frame, rect(0, 0, 720, 8));
  });

  it('places the title at the padded top with the measured height', () => {
    expectFrame(child(laidOut(), 1).frame, rect(36, 36, 648, 20));
  });

  it('lets the cards row grow into the remaining height', () => {
    expectFrame(child(laidOut(), 2).frame, rect(36, 72, 648, 251));
  });

  it('splits the cards row in three equal cards', () => {
    const slide = laidOut();
    const w = (648 - 40) / 3;
    expectFrame(child(slide, 2, 0).frame, rect(36, 72, w, 251));
    expectFrame(child(slide, 2, 1).frame, rect(36 + w + 20, 72, w, 251));
    expectFrame(child(slide, 2, 2).frame, rect(36 + 2 * (w + 20), 72, w, 251));
  });

  it('lays out the card content inside its padding', () => {
    const slide = laidOut();
    expectFrame(child(slide, 2, 0, 0).frame, rect(46, 82, (648 - 40) / 3 - 20, 20));
    expectFrame(child(slide, 2, 0, 1).frame, rect(46, 107, 40, 4));
  });

  it('places the footer: image by aspect ratio on the left, text on the right, centered vertically', () => {
    const slide = laidOut();
    expectFrame(child(slide, 3).frame, rect(36, 339, 648, 30));
    expectFrame(child(slide, 3, 0).frame, rect(36, 339, 60, 30));
    expectFrame(child(slide, 3, 1).frame, rect(584, 344, 100, 20));
  });
});

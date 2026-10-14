import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type { SlideElement } from '../../../src/core/types.ts';
import { decorationOf } from '../emit/decoration.ts';
import { Box, Deck, Shape, Slide, Span, Text, defineDeck, render } from '../index.ts';
import { paintOrderOf, placementOf } from '../paint.ts';
import { slideToSvg } from '../preview/slide.ts';
import type { PositionedSlide } from '../types.ts';
import { EXAMPLES_DIR, pocFit } from './helpers.ts';

const deckOf = (slide: SlideElement) => defineDeck(() => <Deck>{slide}</Deck>);

const slideOf = (slide: SlideElement): PositionedSlide => pocFit(deckOf(slide), '16x9').positioned.slides[0]!;

const slideXml = async (slide: SlideElement): Promise<string> => {
  const [result] = await render(deckOf(slide), { preview: false, baseDir: EXAMPLES_DIR });
  const zip = await JSZip.loadAsync(result!.buffer);
  return zip.file('ppt/slides/slide1.xml')!.async('string');
};

describe('ordem de pintura (z-index)', () => {
  it('fluxo em ordem da árvore; posicionado depois do fluxo; z negativo antes; z positivo por último', () => {
    const slide = slideOf(
      <Slide>
        <Shape kind="rect" position="absolute" width={10} height={10} />
        <Box height={10} zIndex={2} />
        <Box height={10} />
        <Shape kind="ellipse" position="absolute" width={10} height={10} zIndex={-1} />
        <Text>texto</Text>
      </Slide>,
    );
    expect(paintOrderOf(slide).map((item) => item.node.path)).toEqual([
      'Slide > Shape[1]',
      'Slide > Box[1]',
      'Slide > Text',
      'Slide > Shape[0]',
      'Slide > Box[0]',
    ]);
  });

  it('a subárvore de quem sobe de camada vai junto (pinta atômica)', () => {
    const slide = slideOf(
      <Slide>
        <Box zIndex={1}>
          <Text>a</Text>
        </Box>
        <Box>
          <Text>b</Text>
        </Box>
      </Slide>,
    );
    expect(paintOrderOf(slide).map((item) => item.node.path)).toEqual([
      'Slide > Box[1]',
      'Slide > Box[1] > Text',
      'Slide > Box[0]',
      'Slide > Box[0] > Text',
    ]);
  });

  it('opacity multiplica pelos ancestrais; rotate acumula', () => {
    const slide = slideOf(
      <Slide>
        <Box opacity={0.5} rotate={10} width={100} height={100}>
          <Box opacity={0.5} rotate="5deg" height={10} />
        </Box>
      </Slide>,
    );
    const inner = paintOrderOf(slide).find((item) => item.node.path === 'Slide > Box > Box')!;
    expect(inner.opacity).toBeCloseTo(0.25);
    expect(placementOf(inner.node.frame, inner.rotations).rotate).toBeCloseTo(15);
  });
});

describe('decoração da caixa', () => {
  const itemOf = (slide: PositionedSlide, path: string) => paintOrderOf(slide).find((item) => item.node.path === path)!;

  it('borda uniforme: uma forma com o frame recuado em largura/2 (traço dentro do border-box)', () => {
    const slide = slideOf(
      <Slide>
        <Box width={72} height={72} backgroundColor="#FF0000" border="8px solid #00FF00" />
      </Slide>,
    );
    const { under, over } = decorationOf(slide.children[0]!, itemOf(slide, 'Slide > Box'));
    expect(over).toEqual([]);
    expect(under).toHaveLength(1);
    expect(under[0]!.options).toMatchObject({ x: 4 / 72, y: 4 / 72, w: 64 / 72, h: 64 / 72, line: { width: 8, color: '00FF00' }, fill: { color: 'FF0000' } });
  });

  it('bordas diferentes por lado: fundo sem linha + uma linha por lado', () => {
    const slide = slideOf(
      <Slide>
        <Box width={100} height={50} backgroundColor="#EEEEEE" borderTop="4px solid #2F6FED" borderBottom="1px dashed #999999" />
      </Slide>,
    );
    const { under, over } = decorationOf(slide.children[0]!, itemOf(slide, 'Slide > Box'));
    expect(under).toHaveLength(1);
    expect(under[0]!.options.line).toBeUndefined();
    expect(over.map((spec) => spec.shape)).toEqual(['line', 'line']);
    expect(over[1]!.options.line).toMatchObject({ dashType: 'dash', width: 1 });
  });

  it('stroke antigo continua sendo uma forma só no frame (como a engine)', () => {
    const slide = slideOf(
      <Slide>
        <Box width={100} height={50} fill="#EEEEEE" stroke="#000000" strokeWidth={2} radius={6} />
      </Slide>,
    );
    const { under } = decorationOf(slide.children[0]!, itemOf(slide, 'Slide > Box'));
    expect(under).toHaveLength(1);
    expect(under[0]).toMatchObject({ shape: 'roundRect', options: { x: 0, y: 0, line: { width: 2 } } });
  });
});

describe('XML do .pptx', () => {
  it('sombra, rotação, opacidade, letterSpacing e decoração de texto saem nativos', async () => {
    const xml = await slideXml(
      <Slide>
        <Box width={100} height={60} backgroundColor="#FFFFFF" boxShadow="0 4px 12px rgba(0,0,0,0.25)" rotate={15} opacity={0.5} />
        <Text letterSpacing={2} textDecoration="underline">
          Título <Span textDecoration="line-through">riscado</Span>
        </Text>
      </Slide>,
    );
    expect(xml).toContain('<a:outerShdw');
    expect(xml).toMatch(/rot="900000"/);
    expect(xml).toMatch(/<a:alpha val="50000"\/>/);
    expect(xml).toMatch(/spc="200"/);
    expect(xml).toMatch(/u="sng"/);
    expect(xml).toMatch(/strike="sngStrike"/);
  });

  it('z-index muda a ordem das formas no slide', async () => {
    const xml = await slideXml(
      <Slide>
        <Box height={10} backgroundColor="#111111" zIndex={1} />
        <Box height={10} backgroundColor="#222222" />
      </Slide>,
    );
    expect(xml.indexOf('222222')).toBeLessThan(xml.indexOf('111111'));
  });
});

describe('css-not-emitted', () => {
  it('propriedade sem de/para vira warning com propriedade e path; nada some em silêncio', () => {
    const { diagnostics } = pocFit(
      deckOf(
        <Slide>
          <Box height={10} style={{ filter: 'blur(2px)' }} transform="skewX(10deg)" overflow="hidden" />
          <Box height={10} boxShadow="inset 0 0 4px #000" backgroundColor="#FFFFFF" />
        </Slide>,
      ),
      '16x9',
    );
    const notEmitted = diagnostics.filter((d) => d.code === 'css-not-emitted');
    expect(notEmitted.every((d) => d.severity === 'warning')).toBe(true);
    const messages = notEmitted.map((d) => `${d.path}: ${d.message}`).join('\n');
    expect(messages).toContain('Slide > Box[0]: A propriedade CSS filter');
    expect(messages).toContain('skewX(10deg)');
    expect(messages).toContain('overflow: hidden');
    expect(messages).toContain('Slide > Box[1]: A propriedade CSS boxShadow');
  });

  it('fontWeight fora de 400/700 avisa que sai como regular/bold', () => {
    const { diagnostics } = pocFit(deckOf(<Slide><Text fontWeight={500}>x</Text></Slide>), '16x9');
    expect(diagnostics.map((d) => d.message).join()).toContain('sai como regular');
  });
});

describe('preview', () => {
  it('desenha sombra, borda por lado, rotação e opacidade', () => {
    const slide = slideOf(
      <Slide>
        <Box width={100} height={60} backgroundColor="#FFFFFF" boxShadow="0 4px 12px #000" borderLeft="4px solid #2F6FED" rotate={15} opacity={0.5} />
      </Slide>,
    );
    const svg = slideToSvg(slide, { name: '16x9', width: 720, height: 405 }, { widthPx: 320, baseDir: EXAMPLES_DIR });
    expect(svg).toContain('feDropShadow');
    expect(svg).toContain('rotate(15');
    expect(svg).toContain('opacity="0.5"');
    expect(svg).toMatch(/<line x1="2" y1="0" x2="2" y2="60"/);
  });
});

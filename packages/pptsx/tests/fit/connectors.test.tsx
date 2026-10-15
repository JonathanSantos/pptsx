import { describe, expect, it } from 'vitest';
import { anchorOf, elbowOf, labelAnchorOf, routeOf, sidesOf, simplify } from '../../src/fit/connectors.ts';
import { Box, Connector, Deck, Slide, Text } from '../../src/primitives/index.ts';
import { resolveDeck } from '../../src/resolve/index.ts';
import { createContext, resolveSize } from '../../src/sizes.ts';
import type { ResolvedConnector, SlideElement } from '../../src/core/types.ts';
import { rect } from '../helpers/nodes.ts';
import { build, shapesOf } from '../helpers/build.tsx';

const A = rect(100, 100, 100, 50);

describe('M12-5 — âncoras e lados', () => {
  it('ponto médio de cada lado', () => {
    expect(anchorOf(A, 'top')).toEqual({ x: 150, y: 100 });
    expect(anchorOf(A, 'right')).toEqual({ x: 200, y: 125 });
    expect(anchorOf(A, 'bottom')).toEqual({ x: 150, y: 150 });
    expect(anchorOf(A, 'left')).toEqual({ x: 100, y: 125 });
  });

  it.each([
    ['à direita', rect(300, 100, 100, 50), ['right', 'left']],
    ['à esquerda', rect(-150, 100, 100, 50), ['left', 'right']],
    ['abaixo', rect(100, 300, 100, 50), ['bottom', 'top']],
    ['acima', rect(100, -150, 100, 50), ['top', 'bottom']],
  ] as const)('auto com o alvo %s escolhe o par de lados que se encaram', (_where, target, expected) => {
    expect(sidesOf(A, target)).toEqual(expected);
  });

  it('um lado fixo: auto escolhe só o outro', () => {
    expect(sidesOf(A, rect(300, 300, 100, 50), 'bottom')).toEqual(['bottom', 'left']);
  });
});

describe('M12-5 — rotas', () => {
  const props = (over: Partial<ResolvedConnector['props']> = {}) => ({ props: { from: 'a', to: 'b', ...over } });

  it('straight: 2 pontos', () => {
    expect(routeOf(props(), A, rect(300, 100, 100, 50))).toEqual([{ x: 200, y: 125 }, { x: 300, y: 125 }]);
  });

  it('elbow com lados opostos: 3 segmentos com a dobra no meio', () => {
    expect(routeOf(props({ route: 'elbow' }), A, rect(300, 200, 100, 50))).toEqual([
      { x: 200, y: 125 },
      { x: 250, y: 125 },
      { x: 250, y: 225 },
      { x: 300, y: 225 },
    ]);
  });

  it('elbow com eixos mistos: um L (3 pontos) saindo pelo lado de from', () => {
    expect(routeOf(props({ route: 'elbow', fromSide: 'right', toSide: 'top' }), A, rect(300, 300, 100, 50))).toEqual([
      { x: 200, y: 125 },
      { x: 350, y: 125 },
      { x: 350, y: 300 },
    ]);
  });

  it('elbow com o mesmo lado: a dobra sai para fora dos nós', () => {
    const [, bend] = elbowOf({ x: 200, y: 125 }, { x: 400, y: 325 }, 'right', 'right');
    expect(bend!.x).toBeGreaterThan(400);
  });

  it('cotovelo alinhado vira reta (pontos colineares fundidos)', () => {
    expect(routeOf(props({ route: 'elbow' }), A, rect(300, 100, 100, 50))).toHaveLength(2);
    expect(simplify([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }])).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }]);
  });

  it('rótulo no meio do segmento mais longo', () => {
    expect(labelAnchorOf([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 100 }])).toEqual({ x: 10, y: 50 });
  });
});

const ctx = createContext(resolveSize('16x9'));
const resolve = (children: unknown) => resolveDeck((<Deck><Slide>{children as SlideElement}</Slide></Deck>) as SlideElement, ctx);

describe('M12-5 — resolve', () => {
  it('Connector sai da árvore e vai para slide.connectors com path próprio', () => {
    const deck = resolve(
      <>
        <Box id="a" width={10} height={10} />
        <Box>
          <Box id="b" width={10} height={10} />
          <Connector from="a" to="b" label="ok" />
        </Box>
      </>,
    );
    const slide = deck.slides[0]!;
    expect(slide.children).toHaveLength(2);
    expect(slide.connectors).toEqual([expect.objectContaining({ kind: 'connector', path: 'Slide > Box[1] > Connector', props: expect.objectContaining({ from: 'a', to: 'b' }) })]);
    expect(slide.connectors![0]!.label).toMatchObject({ kind: 'text', content: 'ok', path: 'Slide > Box[1] > Connector > Label' });
    expect(slide.connectors![0]!.missing).toBeUndefined();
  });

  it('id duplicado no slide → ResolveError apontando os dois', () => {
    expect(() => resolve(<><Box id="a" /><Text id="a">x</Text></>)).toThrow(/id "a" repetido no slide \(já usado em Slide > Box\)/);
  });

  it('ponta sem nó: missing (o fit reporta)', () => {
    expect(resolve(<><Box id="a" /><Connector from="a" to="zz" /></>).slides[0]!.connectors![0]!.missing).toEqual(['to']);
  });

  it('props inválidas → ResolveError', () => {
    expect(() => resolve(<Connector from="a" to={'' as never} />)).toThrow(/precisa de to/);
    expect(() => resolve(<Connector from="a" to="b" route={'curva' as never} />)).toThrow(/route "curva"/);
    expect(() => resolve(Connector({ from: 'a', to: 'b', backgroundColor: '#fff' } as never))).toThrow(/não aceita "backgroundColor"/);
  });

  it('display: none leva junto os conectores declarados dentro', () => {
    const deck = resolve(<><Box id="a" /><Box display="none"><Connector from="a" to="a" /></Box></>);
    expect(deck.slides[0]!.connectors).toBeUndefined();
  });
});

const flow = (connector: unknown) => (
  <Deck>
    <Slide>
      <Box id="a" position="absolute" left={100} top={100} width={100} height={50} backgroundColor="#EEEEEE" />
      <Box id="b" position="absolute" left={300} top={200} width={100} height={50} backgroundColor="#EEEEEE" />
      {connector as never}
    </Slide>
  </Deck>
);

describe('M12-5 — de ponta a ponta', () => {
  it('reta: shape line com flip pela direção, tailEnd padrão (triangle)', async () => {
    const { xml, diagnostics, positioned } = await build(flow(<Connector from="b" to="a" fromSide="left" toSide="right" />));
    expect(diagnostics).toEqual([]);
    expect(positioned.slides[0]!.connectors![0]!.points).toEqual([{ x: 300, y: 225 }, { x: 200, y: 125 }]);
    const line = shapesOf(xml[0]!).at(-1)!;
    expect(line).toContain('<a:prstGeom prst="line">');
    expect(line).toMatch(/<a:xfrm flipH="1" flipV="1">/);
    expect(line).toContain('<a:tailEnd type="triangle"/>');
    expect(line).not.toContain('headEnd');
  });

  it('cotovelo: custGeom aberto (sem close, sem fill) com as duas pontas', async () => {
    const { xml } = await build(flow(<Connector from="a" to="b" route="elbow" startArrow="oval" endArrow="stealth" lineStyle="dashed" />));
    const shape = shapesOf(xml[0]!).at(-1)!;
    expect(shape).toContain('<a:custGeom>');
    expect(shape).not.toContain('<a:close');
    expect(shape).toContain('<a:noFill/>');
    expect(shape).toContain('<a:headEnd type="oval"/>');
    expect(shape).toContain('<a:tailEnd type="stealth"/>');
    expect(shape).toContain('<a:prstDash val="dash"/>');
  });

  it('rótulo: fundo + caixa de texto por cima da linha; preview com polígono de ponta', async () => {
    const { xml, svg } = await build(flow(<Connector from="a" to="b" label="sim" labelStyle={{ background: '#FFFFFF', color: '#112233' }} />));
    const shapes = shapesOf(xml[0]!);
    expect(shapes.at(-2)).toContain('<a:srgbClr val="FFFFFF"/>');
    expect(shapes.at(-1)).toContain('<a:t>sim</a:t>');
    expect(svg[0]).toContain('<polyline');
    expect(svg[0]).toContain('<polygon');
    expect(svg[0]).not.toContain('<marker');
    expect(svg[0]).toContain('>sim</tspan>');
  });

  it('id inexistente → connector-target-missing (error) com os ids do slide; nada desenhado', async () => {
    const { diagnostics, positioned } = await build(flow(<Connector from="a" to="c" />));
    expect(diagnostics).toEqual([expect.objectContaining({ code: 'connector-target-missing', severity: 'error', path: 'Slide > Connector' })]);
    expect(diagnostics[0]!.message).toMatch(/to="c".*"a", "b"/);
    expect(positioned.slides[0]!.connectors).toBeUndefined();
  });

  it('slide paginado: pontas em partes diferentes → omitido com info na parte de from', async () => {
    const items = Array.from({ length: 14 }, (_, index) => (
      <Text id={`i${index}`} fontSize={28}>{`Item ${index}`}</Text>
    ));
    const { diagnostics, positioned } = await build(
      <Deck>
        <Slide padding={20}>
          <Box paginate gap={4}>{items}</Box>
          <Connector from="i0" to="i13" />
          <Connector from="i0" to="i1" />
        </Slide>
      </Deck>,
    );
    expect(positioned.slides.length).toBeGreaterThan(1);
    const omitted = diagnostics.filter((d) => d.code === 'connector-omitted');
    expect(omitted).toEqual([expect.objectContaining({ severity: 'info', slide: 1, path: 'Slide > Connector[0]' })]);
    expect(positioned.slides[0]!.connectors?.map((c) => c.path)).toEqual(['Slide > Connector[1]']);
    expect(positioned.slides.slice(1).every((slide) => slide.connectors === undefined)).toBe(true);
  });
});

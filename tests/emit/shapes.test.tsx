import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/core/defaults.ts';
import type { ShapeKind } from '../../src/core/types.ts';
import { Box, Deck, Shape, Slide, Text } from '../../src/primitives/index.ts';
import { applyLineMarkers, lineMarkerOf } from '../../src/emit/line-style.ts';
import { build, shapesOf } from '../helpers/build.tsx';

const KINDS = Object.keys(DEFAULTS.shape.pptx) as ShapeKind[];

const one = (node: unknown) => (
  <Deck>
    <Slide>{node as never}</Slide>
  </Deck>
);

describe('M12-2 — formas no PPTX', () => {
  it.each(KINDS)('kind "%s" vira o prstGeom da tabela DEFAULTS.shape.pptx', async (kind) => {
    const { xml, diagnostics } = await build(one(<Shape kind={kind} position="absolute" left={10} top={10} width={80} height={40} fill="#336699" />));
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const [shape] = shapesOf(xml[0]!);
    expect(shape).toContain(`<a:prstGeom prst="${DEFAULTS.shape.pptx[kind].prst}">`);
  });

  it('pill = roundRect com adj 50000 (raio = metade do menor lado)', async () => {
    const { xml } = await build(one(<Shape kind="pill" position="absolute" left={0} top={0} width={120} height={40} fill="#336699" />));
    expect(shapesOf(xml[0]!)[0]).toMatch(/<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 50000"\/>/);
  });

  it('kinds novas saem sem avLst (ajustes padrão do OOXML)', async () => {
    const { xml } = await build(one(<Shape kind="chevron" position="absolute" left={0} top={0} width={120} height={40} fill="#336699" />));
    expect(shapesOf(xml[0]!)[0]).toContain('<a:prstGeom prst="chevron"><a:avLst></a:avLst></a:prstGeom>');
  });

  it('flipH e flipV vão para o xfrm', async () => {
    const { xml } = await build(one(<Shape kind="rightTriangle" flipH flipV position="absolute" left={0} top={0} width={50} height={40} fill="#336699" />));
    expect(shapesOf(xml[0]!)[0]).toMatch(/<a:xfrm flipH="1" flipV="1">/);
  });

  it('line com setas, tracejado e ponta redonda', async () => {
    const { xml } = await build(
      one(<Shape kind="line" position="absolute" left={0} top={20} width={200} height={0} stroke="#112233" strokeWidth={2}
        startArrow="oval" endArrow="triangle" lineStyle="dashed" lineCap="round" />),
    );
    const [line] = shapesOf(xml[0]!);
    expect(line).toContain('<a:headEnd type="oval"/>');
    expect(line).toContain('<a:tailEnd type="triangle"/>');
    expect(line).toContain('<a:prstDash val="dash"/>');
    expect(line).toMatch(/<a:ln w="25400" cap="rnd">/);
    // A marca de cap/join não fica no nome.
    expect(line).not.toContain('pptsx-ln');
  });

  it('dotted → sysDot; sem setas não há headEnd/tailEnd', async () => {
    const { xml } = await build(one(<Shape kind="rect" position="absolute" left={0} top={0} width={50} height={40} stroke="#000000" lineStyle="dotted" />));
    const [shape] = shapesOf(xml[0]!);
    expect(shape).toContain('<a:prstDash val="sysDot"/>');
    expect(shape).not.toMatch(/headEnd|tailEnd/);
  });

  it('bracketPair sem stroke recebe traço (como a linha)', async () => {
    const { xml } = await build(one(<Shape kind="bracketPair" position="absolute" left={0} top={0} width={80} height={40} />));
    expect(shapesOf(xml[0]!)[0]).toMatch(/<a:ln[^>]*><a:solidFill><a:srgbClr val="000000"/);
  });
});

describe('M12-2 — Box shape', () => {
  it('desenha o fundo com a geometria e mantém o texto dentro do padding', async () => {
    const { xml, positioned } = await build(
      one(
        <Box shape="hexagon" position="absolute" left={100} top={50} width={200} height={100} padding="10 40" backgroundColor="#2F6FED">
          <Text fontSize={14}>dentro</Text>
        </Box>,
      ),
    );
    const shapes = shapesOf(xml[0]!);
    expect(shapes[0]).toContain('<a:prstGeom prst="hexagon">');
    const box = positioned.slides[0]!.children[0]!;
    if (box.kind !== 'box') throw new Error('box esperado');
    const text = box.children[0]!;
    expect(text.frame.x).toBeCloseTo(140, 3);
    expect(text.frame.y).toBeCloseTo(60, 3);
    expect(text.frame.width).toBeCloseTo(120, 3);
  });

  it('borda uniforme sai na mesma geometria, recuada em largura/2', async () => {
    const { xml } = await build(
      one(<Box shape="diamond" position="absolute" left={0} top={0} width={100} height={60} border="4px solid #112233" />),
    );
    const [shape] = shapesOf(xml[0]!);
    expect(shape).toContain('<a:prstGeom prst="diamond">');
    expect(shape).toMatch(/<a:off x="25400" y="25400"\/>/);
  });

  it('raio e bordas por lado numa forma viram css-not-emitted', async () => {
    const { diagnostics, xml } = await build(
      one(<Box shape="hexagon" position="absolute" left={0} top={0} width={100} height={60} borderRadius={8} borderTop="2px solid #000" backgroundColor="#EEEEEE" />),
    );
    const notes = diagnostics.filter((d) => d.code === 'css-not-emitted').map((d) => d.message);
    expect(notes.some((m) => m.includes('borderRadius'))).toBe(true);
    expect(notes.some((m) => m.includes('border: por lado'))).toBe(true);
    // Nenhuma linha por lado: só o fundo hexagonal.
    expect(shapesOf(xml[0]!)).toHaveLength(1);
  });

  it('sem shape continua rect/roundRect pelo raio', async () => {
    const { xml } = await build(one(<Box position="absolute" left={0} top={0} width={100} height={60} borderRadius={8} backgroundColor="#EEEEEE" />));
    expect(shapesOf(xml[0]!)[0]).toContain('<a:prstGeom prst="roundRect">');
  });
});

describe('M12-2 — marca de cap/join (line-style.ts)', () => {
  it('sem cap redondo nem junção custom não marca', () => {
    expect(lineMarkerOf({}, 0)).toEqual({});
    expect(lineMarkerOf({ cap: 'flat', join: 'miter' }, 0)).toEqual({});
  });

  it('põe cap e a junção no <a:ln> na ordem do schema (antes das pontas)', () => {
    const { objectName } = lineMarkerOf({ cap: 'round', join: 'round' }, 3);
    const xml = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="${objectName}"></p:cNvPr></p:nvSpPr><a:ln w="12700"><a:solidFill/><a:prstDash val="dash"/><a:tailEnd type="triangle"/></a:ln></p:sp>`;
    expect(applyLineMarkers(xml)).toBe(
      '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Forma"></p:cNvPr></p:nvSpPr><a:ln w="12700" cap="rnd"><a:solidFill/><a:prstDash val="dash"/><a:round/><a:tailEnd type="triangle"/></a:ln></p:sp>',
    );
  });

  it('não mexe em shapes sem marca', () => {
    const xml = '<p:sp><p:cNvPr id="2" name="Shape 1"/><a:ln w="12700"></a:ln></p:sp>';
    expect(applyLineMarkers(xml)).toBe(xml);
  });
});

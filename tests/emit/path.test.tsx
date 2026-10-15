import { describe, expect, it } from 'vitest';
import { Box, Deck, Path, Slide } from '../../src/primitives/index.ts';
import { build, shapesOf } from '../helpers/build.tsx';

const EMU = 12700;
const one = (node: unknown) => (
  <Deck>
    <Slide>{node as never}</Slide>
  </Deck>
);

describe('M12-3 — Path', () => {
  it('vira custGeom com moveTo/lnTo/cubicBezTo/quadBezTo/close escalados do viewBox', async () => {
    const { xml, diagnostics } = await build(
      one(<Path d="M0 0 L10 0 C10 5 5 10 0 10 Q0 5 0 0 Z" viewBox={[10, 10]} position="absolute" left={72} top={72} width={72} height={72} fill="#2F6FED" />),
    );
    expect(diagnostics).toEqual([]);
    const [shape] = shapesOf(xml[0]!);
    expect(shape).toContain('<a:custGeom>');
    expect(shape).toMatch(/<a:path w="914400" h="914400">/);
    expect(shape).toContain('<a:moveTo><a:pt x="0" y="0" /></a:moveTo>');
    expect(shape).toContain('<a:lnTo><a:pt x="914400" y="0" /></a:lnTo>');
    expect(shape).toMatch(/<a:cubicBezTo>\s*<a:pt x="914400" y="457200" \/>/);
    expect(shape).toContain('<a:quadBezTo>');
    expect(shape).toContain('<a:close />');
    expect(shape).toMatch(/<a:solidFill><a:srgbClr val="2F6FED"/);
  });

  it('sem width/height tem o tamanho do viewBox (caixa envolvente do d)', async () => {
    const { positioned } = await build(one(<Path d="M10 10 L70 10 L40 50 Z" fill="#000000" />));
    const node = positioned.slides[0]!.children[0]!;
    expect(node.frame.width).toBeCloseTo(60, 6);
    expect(node.frame.height).toBeCloseTo(40, 6);
  });

  it('só width: altura pela proporção do viewBox', async () => {
    const { positioned } = await build(one(<Box alignItems="flex-start"><Path d="M0 0 H40 V20 H0 Z" width={80} fill="#000000" /></Box>));
    const box = positioned.slides[0]!.children[0]!;
    if (box.kind !== 'box') throw new Error('box');
    expect(box.children[0]!.frame.height).toBeCloseTo(40, 6);
  });

  it('sem fill nem stroke: fill preto (como o SVG); stroke com ponta e junção redondas', async () => {
    const plain = await build(one(<Path d="M0 0 H10 V10 Z" />));
    expect(shapesOf(plain.xml[0]!)[0]).toMatch(/<a:srgbClr val="000000"/);
    const stroked = await build(one(<Path d="M0 0 L10 10 L20 0" stroke="#EF4444" strokeWidth={2} lineCap="round" lineJoin="round" />));
    const [shape] = shapesOf(stroked.xml[0]!);
    expect(shape).toContain('<a:noFill/>');
    expect(shape).toMatch(new RegExp(`<a:ln w="${2 * EMU}" cap="rnd">.*<a:round/></a:ln>`));
  });

  it('d inválido → path-invalid (error) e nada desenhado', async () => {
    const { xml, diagnostics } = await build(one(<Path d="M0 0 X10" width={10} height={10} fill="#000000" />));
    expect(diagnostics).toEqual([expect.objectContaining({ code: 'path-invalid', severity: 'error', path: 'Slide > Path' })]);
    expect(shapesOf(xml[0]!)).toHaveLength(0);
  });

  it('viewBox inválido → ResolveError', async () => {
    await expect(build(one(<Path d="M0 0 H10" viewBox={[0, 10] as never} />))).rejects.toThrow(/viewBox/);
  });

  it('preview: <path> com os comandos no frame; borda CSS vira o stroke', async () => {
    const { svg, xml } = await build(one(<Path d="M0 0 H10 V10 Z" viewBox={[10, 10]} position="absolute" left={100} top={50} width={20} height={20} border="2px solid #112233" />));
    expect(svg[0]).toContain('d="M100 50 L120 50 L120 70 Z"');
    expect(svg[0]).toContain('stroke="#112233"');
    // Sem caixa: só o próprio custGeom.
    expect(shapesOf(xml[0]!)).toHaveLength(1);
  });
});

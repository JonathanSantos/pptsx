import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Box, Deck, Icon, Slide } from '../../src/primitives/index.ts';
import { resolveDeck } from '../../src/resolve/index.ts';
import { createContext, resolveSize } from '../../src/sizes.ts';
import type { SlideElement } from '../../src/core/types.ts';
import { build, shapesOf } from '../helpers/build.tsx';

let baseDir = '';
const STROKE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>';
const WIDE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24"><rect width="48" height="24"/></svg>';
const GRADIENT = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/></linearGradient></defs><circle cx="12" cy="12" r="10" fill="url(#g)"/></svg>';

beforeAll(() => {
  baseDir = mkdtempSync(join(tmpdir(), 'pptsx-icon-'));
  writeFileSync(join(baseDir, 'stroke.svg'), STROKE);
  writeFileSync(join(baseDir, 'wide.svg'), WIDE);
  writeFileSync(join(baseDir, 'gradient.svg'), GRADIENT);
});

afterAll(() => rmSync(baseDir, { recursive: true, force: true }));

const one = (node: unknown) => (
  <Deck>
    <Slide alignItems="flex-start">{node as never}</Slide>
  </Deck>
);
const built = (node: unknown) => build(one(node), { baseDir });

describe('M12-4 — Icon', () => {
  it('SVG só com formas → um custGeom por traço, cor herdada, traço escalado, ponta e junção redondas', async () => {
    const { xml, diagnostics, positioned } = await built(<Box color="#10B981"><Icon src="stroke.svg" size={48} /></Box>);
    expect(diagnostics).toEqual([]);
    const shapes = shapesOf(xml[0]!);
    expect(shapes).toHaveLength(2);
    shapes.forEach((shape) => {
      expect(shape).toContain('<a:custGeom>');
      expect(shape).toContain('<a:srgbClr val="10B981"/>');
      // 2 unidades do viewBox × (48/24) = 4 pt.
      expect(shape).toMatch(new RegExp(`<a:ln w="${4 * 12700}" cap="rnd">.*<a:round/>`));
      expect(shape).toContain('<a:noFill/>');
    });
    const box = positioned.slides[0]!.children[0]!;
    if (box.kind !== 'box') throw new Error('box');
    expect(box.children[0]!.frame).toMatchObject({ width: 48, height: 48 });
  });

  it('altura = size (padrão 24) e largura pela proporção do viewBox; color da prop vence', async () => {
    const { positioned, xml } = await built(<Icon src="wide.svg" color="#EF4444" />);
    expect(positioned.slides[0]!.children[0]!.frame).toMatchObject({ width: 48, height: 24 });
    expect(shapesOf(xml[0]!)[0]).toContain('<a:srgbClr val="EF4444"/>');
  });

  it('width e height do autor: desenho centrado sem distorcer (meet)', async () => {
    const { svg } = await built(<Icon src="wide.svg" width={48} height={48} position="absolute" left={0} top={0} />);
    expect(svg[0]).toContain('d="M0 12 L48 12 L48 36 L0 36 Z"');
  });

  it('gradiente → imagem PNG e icon-rasterized (info)', async () => {
    const { xml, diagnostics, svg } = await built(<Icon src="gradient.svg" size={40} />);
    expect(diagnostics).toEqual([expect.objectContaining({ code: 'icon-rasterized', severity: 'info', path: 'Slide > Icon' })]);
    expect(diagnostics[0]!.message).toMatch(/<defs>/);
    expect(xml[0]).toContain('<p:pic>');
    expect(shapesOf(xml[0]!)).toHaveLength(0);
    expect(svg[0]).toContain('href="data:image/png;base64,');
  });

  it('render="image" força a imagem mesmo num SVG vetorizável', async () => {
    const { xml, diagnostics } = await built(<Icon src="stroke.svg" render="image" />);
    expect(xml[0]).toContain('<p:pic>');
    expect(diagnostics[0]!.message).toMatch(/render="image" foi pedido/);
  });

  it('render="shape" num SVG não vetorizável → ResolveError', async () => {
    await expect(built(<Icon src="gradient.svg" render="shape" />)).rejects.toThrow(/render="shape"/);
  });

  it('arquivo inexistente → ResolveError com o src', async () => {
    await expect(built(<Icon src="nao-existe.svg" />)).rejects.toThrow(/nao-existe\.svg/);
  });

  it('fundo/borda no Icon viram css-not-emitted', async () => {
    const { diagnostics } = await built(<Icon src="stroke.svg" backgroundColor="#EEEEEE" border="1px solid #000" />);
    expect(diagnostics.filter((d) => d.code === 'css-not-emitted')).toHaveLength(2);
  });

  it('resolveDeck lê o asset pelo env injetado (IO na borda)', () => {
    const reads: string[] = [];
    const env = { readAsset: (src: string) => (reads.push(src), STROKE) };
    const deck = resolveDeck(one(<Icon src="qualquer.svg" />) as SlideElement, createContext(resolveSize('16x9')), env);
    expect(reads).toEqual(['qualquer.svg']);
    expect(deck.slides[0]!.children[0]).toMatchObject({ kind: 'icon', viewBox: { width: 24, height: 24 } });
  });
});

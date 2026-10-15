import { describe, expect, it } from 'vitest';
import { readIcon, recoloredSvg } from '../../src/resolve/svg-icon.ts';

const OPTIONS = { color: '#2F6FED', recolor: true };
const svg = (body: string, root = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"') =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${root}>${body}</svg>`;

const vector = (text: string, options = OPTIONS) => {
  const icon = readIcon(text, options);
  if (!('paths' in icon.content)) throw new Error(`raster: ${icon.content.reason}`);
  return icon.content.paths;
};

const reasonOf = (text: string): string => {
  const icon = readIcon(text, OPTIONS);
  if (!('raster' in icon.content)) throw new Error('esperava raster');
  return icon.content.reason;
};

describe('M12-4 — classificação do SVG', () => {
  it('formas simples viram traços com a pintura herdada do <svg>', () => {
    const paths = vector(svg('<circle cx="12" cy="12" r="10"/><path d="M8 12h8" stroke-linecap="round"/><rect x="2" y="2" width="4" height="4" rx="1"/><line x1="0" y1="0" x2="1" y2="1"/><polygon points="1 1 2 2 3 1"/><polyline points="1 1 2 2"/><ellipse cx="5" cy="5" rx="2" ry="1"/>'));
    expect(paths).toHaveLength(7);
    expect(paths[0]).toMatchObject({ stroke: '#2F6FED', strokeWidth: 2, lineCap: 'flat', lineJoin: 'miter' });
    expect(paths[0]!.fill).toBeUndefined();
    expect(paths[1]).toMatchObject({ lineCap: 'round' });
    expect(paths[4]!.commands.at(-1)).toEqual({ op: 'Z' });
    expect(paths[5]!.commands.at(-1)).not.toEqual({ op: 'Z' });
  });

  it('círculo vira cúbicas fechadas na caixa do círculo', () => {
    const [circle] = vector(svg('<circle cx="12" cy="12" r="10"/>'));
    const ends = circle!.commands.filter((c) => c.op === 'C').map((c) => (c.op === 'C' ? [Math.round(c.x), Math.round(c.y)] : []));
    expect(ends).toContainEqual([22, 12]);
    expect(ends).toContainEqual([2, 12]);
  });

  it('fill padrão do SVG é preto; com recolor vira a cor do ícone', () => {
    const [path] = vector(svg('<path d="M0 0h10v10z"/>', 'viewBox="0 0 10 10"'));
    expect(path).toMatchObject({ fill: '#2F6FED' });
    const [kept] = vector(svg('<path d="M0 0h10v10z"/>', 'viewBox="0 0 10 10"'), { color: '#2F6FED', recolor: false });
    expect(kept).toMatchObject({ fill: '#000000' });
  });

  it('cores próprias ficam; style com pintura conhecida vale', () => {
    const [a, b] = vector(svg('<path d="M0 0h1" stroke="#ff0000"/><path d="M0 0h1" style="stroke: rgb(0, 128, 0); stroke-width: 3"/>'));
    expect(a).toMatchObject({ stroke: '#FF0000' });
    expect(b).toMatchObject({ stroke: '#008000', strokeWidth: 3 });
  });

  it('g sem transform herda a pintura; title/desc são ignorados', () => {
    const paths = vector(svg('<title>x</title><desc>y</desc><g stroke="#00FF00"><path d="M0 0h1"/></g>'));
    expect(paths).toEqual([expect.objectContaining({ stroke: '#00FF00' })]);
  });

  it.each([
    ['gradiente', '<defs><linearGradient id="g"/></defs><path d="M0 0h1" fill="url(#g)"/>', /<defs>/],
    ['url sem defs', '<path d="M0 0h1" fill="url(#g)"/>', /url/],
    ['transform', '<g transform="rotate(10)"><path d="M0 0h1"/></g>', /transform/],
    ['opacidade', '<path d="M0 0h1" opacity="0.5"/>', /opacity/],
    ['texto', '<text x="0" y="10">A</text>', /<text>/],
    ['use', '<use href="#a"/>', /<use>/],
    ['clipPath', '<clipPath id="c"><rect width="1" height="1"/></clipPath>', /<clippath>/],
    ['evenodd', '<path d="M0 0h1" fill-rule="evenodd"/>', /evenodd/],
    ['dasharray', '<path d="M0 0h1" stroke-dasharray="2 2"/>', /dasharray/],
    ['linecap square', '<path d="M0 0h1" stroke-linecap="square"/>', /square/],
    ['style desconhecido', '<path d="M0 0h1" style="mix-blend-mode: multiply"/>', /mix-blend-mode/],
    ['cor translúcida', '<path d="M0 0h1" stroke="rgba(0,0,0,0.5)"/>', /translúcida/],
  ])('%s → raster com motivo', (_name, body, reason) => {
    expect(reasonOf(svg(body))).toMatch(reason);
  });

  it('viewBox: atributo, senão width/height, senão 24 × 24', () => {
    expect(readIcon(svg('<path d="M0 0h1"/>', 'viewBox="2 4 10 20" stroke="#000"'), OPTIONS).viewBox).toEqual({ x: 2, y: 4, width: 10, height: 20 });
    expect(readIcon(svg('<path d="M0 0h1"/>', 'width="48px" height="32" stroke="#000"'), OPTIONS).viewBox).toEqual({ x: 0, y: 0, width: 48, height: 32 });
    expect(readIcon(svg('<path d="M0 0h1"/>', 'stroke="#000"'), OPTIONS).viewBox).toEqual({ x: 0, y: 0, width: 24, height: 24 });
  });

  it('forceImage pula a classificação; o raster leva o SVG recolorido', () => {
    const icon = readIcon(svg('<path d="M0 0h1"/>'), OPTIONS, true);
    expect(icon.content).toMatchObject({ raster: true, reason: 'render="image"' });
    if (!('raster' in icon.content)) throw new Error('raster');
    expect(icon.content.svg).toContain('stroke="#2F6FED"');
  });

  it('recoloredSvg troca currentColor e, com recolor, preto em fill/stroke', () => {
    expect(recoloredSvg('<path fill="#000" stroke="currentColor"/>', OPTIONS)).toBe('<path fill="#2F6FED" stroke="#2F6FED"/>');
    expect(recoloredSvg('<path fill="black"/>', { ...OPTIONS, recolor: false })).toBe('<path fill="black"/>');
  });
});

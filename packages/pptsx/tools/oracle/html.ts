import type { CaseNode, CssCase } from './cases.ts';

/**
 * Caso → HTML para o Chromium. Mesma convenção da PoC: border-box, números em px (= pt),
 * fonte Liberation Sans (a mesma que a engine mede) registrada como "Arial", texto 18 px
 * preto com line-height normal (o padrão do Text). O #slide é flex column como o <Slide>.
 */

const UNITLESS: ReadonlySet<string> = new Set(['flex', 'flexGrow', 'flexShrink', 'order', 'zIndex', 'opacity', 'lineHeight', 'gridRow', 'gridColumn', 'gridRowStart', 'gridRowEnd', 'gridColumnStart', 'gridColumnEnd', 'aspectRatio', 'fontWeight']);

const kebab = (key: string): string => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

const cssValue = (key: string, value: string | number): string => (typeof value === 'number' && !UNITLESS.has(key) ? `${value}px` : String(value));

const styleOf = (style: Readonly<Record<string, string | number>> = {}): string =>
  Object.entries(style)
    .map(([key, value]) => `${kebab(key)}:${cssValue(key, value)}`)
    .join(';');

const escape = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const nodeHtml = (node: CaseNode): string => {
  const inner = node.text !== undefined ? escape(node.text) : (node.children ?? []).map(nodeHtml).join('');
  return `<div data-id="${node.id}" style="${styleOf(node.style)}">${inner}</div>`;
};

export interface FontFiles {
  readonly regular: string;
  readonly bold: string;
  readonly italic: string;
  readonly boldItalic: string;
}

export const caseHtml = (test: CssCase, fonts: FontFiles): string => `<!doctype html>
<html><head><meta charset="utf-8"><style>
@font-face { font-family: 'Arial'; font-weight: 400; font-style: normal; src: url('file://${fonts.regular}'); }
@font-face { font-family: 'Arial'; font-weight: 700; font-style: normal; src: url('file://${fonts.bold}'); }
@font-face { font-family: 'Arial'; font-weight: 400; font-style: italic; src: url('file://${fonts.italic}'); }
@font-face { font-family: 'Arial'; font-weight: 700; font-style: italic; src: url('file://${fonts.boldItalic}'); }
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
#slide { position: relative; display: flex; flex-direction: column; width: ${test.width}px; height: ${test.height}px;
  font-family: 'Arial'; font-size: 18px; line-height: normal; color: #000; font-kerning: normal; }
</style></head><body><div id="slide">${nodeHtml(test.root)}</div></body></html>`;

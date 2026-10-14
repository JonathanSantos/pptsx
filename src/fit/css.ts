import { uniformBorderOf } from '../emit/index.ts';
import type { CssStyle, Diagnostic, NotEmitted, PositionedDeck, PositionedNode, PositionedSlide } from '../core/types.ts';
import { groupDiagnostics } from './group.ts';

/**
 * M11: diagnóstico `css-not-emitted` (warning). Toda propriedade que chegou ao nó e não tem
 * de/para para o PPTX aparece aqui com o nome, o valor e o path: nada some em silêncio (H6).
 * Duas fontes: o que o resolve já rejeitou (valor sem de/para) e combinações que só se
 * descobrem com o nó inteiro (sombra sem fundo, overflow hidden em caixa, rotate em gráfico).
 */

const SIDES = ['top', 'right', 'bottom', 'left'] as const;

/** Alguma borda visível e não uniforme (vira linha por lado no emissor). */
const hasSideBorders = (css: CssStyle): boolean =>
  SIDES.some((side) => css.border[side].width > 0 && css.border[side].style !== 'none') && uniformBorderOf(css) === undefined;

const contextualOf = (node: PositionedNode): readonly NotEmitted[] => {
  const { css } = node;
  const notes: NotEmitted[] = [];
  if (css.overflow === 'hidden' && node.kind !== 'image') {
    notes.push({ property: 'overflow', value: 'hidden', reason: 'o PPTX não recorta formas; os filhos saem inteiros' });
  }
  if (css.boxShadow !== undefined && css.backgroundColor === undefined && node.kind !== 'shape') {
    notes.push({ property: 'boxShadow', value: 'sombra', reason: 'sem backgroundColor a forma não tem preenchimento e a sombra não aparece no PPTX' });
  }
  if (css.borderRadius !== undefined && css.borderRadius > 0 && hasSideBorders(css)) {
    notes.push({ property: 'borderRadius', value: String(css.borderRadius), reason: 'com bordas diferentes por lado, as linhas das bordas saem retas (o fundo continua arredondado)' });
  }
  if (css.rotate !== 0 && (node.kind === 'chart' || node.kind === 'table')) {
    notes.push({ property: 'rotate', value: String(css.rotate), reason: `${node.kind === 'chart' ? 'gráfico' : 'tabela'} nativo não gira no PPTX` });
  }
  return notes;
};

const messageOf = (note: NotEmitted): string =>
  `A propriedade CSS ${note.property}: ${note.value} não sai no PPTX: ${note.reason}. O preview também não a desenha; remova-a ou troque por uma suportada (ver docs/AGENT_GUIDE.md).`;

const nodesOf = (nodes: readonly PositionedNode[]): readonly PositionedNode[] =>
  nodes.flatMap((node) => (node.kind === 'box' ? [node, ...nodesOf(node.children)] : [node]));

const slideDiagnostics = (slide: PositionedSlide, index: number, size: string): readonly Diagnostic[] => {
  const owners: readonly { readonly path: string; readonly notes: readonly NotEmitted[] }[] = [
    { path: slide.path, notes: slide.css.notEmitted },
    ...nodesOf(slide.children).map((node) => ({ path: node.path, notes: [...node.css.notEmitted, ...contextualOf(node)] })),
  ];
  return owners.flatMap(({ path, notes }) =>
    notes.map(
      (note): Diagnostic => ({
        severity: 'warning',
        code: 'css-not-emitted',
        size,
        slide: index + 1,
        path,
        message: messageOf(note),
      }),
    ),
  );
};

/** Agrupa irmãos só quando a propriedade, o valor e o motivo são os mesmos (a mensagem é a chave). */
const groupByMessage = (diagnostics: readonly Diagnostic[]): readonly Diagnostic[] => {
  const messages = [...new Set(diagnostics.map((d) => d.message))];
  const grouped = messages.flatMap((message) => groupDiagnostics(diagnostics.filter((d) => d.message === message)));
  // Ordem de saída: a do primeiro diagnóstico com a mesma mensagem (sort estável mantém o resto).
  const firstIndex = (d: Diagnostic): number => diagnostics.findIndex((other) => other.message === d.message);
  return [...grouped].sort((a, b) => a.slide - b.slide || firstIndex(a) - firstIndex(b));
};

export const cssNotEmittedOf = (deck: PositionedDeck): readonly Diagnostic[] =>
  groupByMessage(deck.slides.flatMap((slide, index) => slideDiagnostics(slide, index, deck.size.name)));

import { boxShapeOf, uniformBorderOf } from '../emit/index.ts';
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

/** M12: Box com `shape` (não rect): o raio e as bordas por lado não têm de/para na geometria da forma. */
const boxShapeNotes = (node: PositionedNode): readonly NotEmitted[] => {
  const { css } = node;
  const shape = boxShapeOf(node);
  return [
    ...(css.borderRadius !== undefined && css.borderRadius > 0 && shape !== 'roundRect'
      ? [{ property: 'borderRadius', value: String(css.borderRadius), reason: `a forma "${shape}" tem geometria própria; o raio só vale em rect/roundRect` }]
      : []),
    ...(hasSideBorders(css)
      ? [{ property: 'border', value: 'por lado', reason: `a forma "${shape}" só tem contorno inteiro; use uma borda igual nos quatro lados` }]
      : []),
  ];
};

/** M16: ancestral girado mais próximo (o PPTX gira cada forma no próprio centro; gráfico e tabela, nem isso). */
interface Walked {
  readonly node: PositionedNode;
  readonly rotatedAncestor?: { readonly path: string; readonly rotate: number };
}

const rotationNotes = ({ node, rotatedAncestor }: Walked): readonly NotEmitted[] => {
  if (node.kind !== 'chart' && node.kind !== 'table') return [];
  const what = node.kind === 'chart' ? 'gráfico' : 'tabela';
  if (node.css.rotate !== 0) return [{ property: 'rotate', value: String(node.css.rotate), reason: `${what} nativo não gira no PPTX` }];
  if (rotatedAncestor === undefined) return [];
  return [{
    property: 'rotate',
    value: `${rotatedAncestor.rotate} (herdado de ${rotatedAncestor.path})`,
    reason: `${what} nativo não gira no PPTX e sai reto dentro da caixa girada; tire o rotate do ancestral ou o ${what} de dentro dele`,
  }];
};

const contextualOf = (node: PositionedNode): readonly NotEmitted[] => {
  const { css } = node;
  const notes: NotEmitted[] = [];
  if (css.overflow === 'hidden' && node.kind !== 'image') {
    notes.push({ property: 'overflow', value: 'hidden', reason: 'o PPTX não recorta formas; os filhos saem inteiros' });
  }
  if (css.boxShadow !== undefined && css.backgroundColor === undefined && node.kind !== 'shape' && node.kind !== 'path' && node.kind !== 'icon') {
    notes.push({ property: 'boxShadow', value: 'sombra', reason: 'sem backgroundColor a forma não tem preenchimento e a sombra não aparece no PPTX' });
  }
  if (css.borderRadius !== undefined && css.borderRadius > 0 && hasSideBorders(css) && boxShapeOf(node) === 'rect') {
    notes.push({ property: 'borderRadius', value: String(css.borderRadius), reason: 'com bordas diferentes por lado, as linhas das bordas saem retas (o fundo continua arredondado)' });
  }
  if (boxShapeOf(node) !== 'rect') notes.push(...boxShapeNotes(node));
  return notes;
};

const messageOf = (note: NotEmitted): string =>
  `A propriedade CSS ${note.property}: ${note.value} não sai no PPTX: ${note.reason}. O preview também não a desenha; remova-a ou troque por uma suportada (ver docs/AGENT_GUIDE.md).`;

const nodesOf = (nodes: readonly PositionedNode[], rotatedAncestor?: Walked['rotatedAncestor']): readonly Walked[] =>
  nodes.flatMap((node): readonly Walked[] => {
    const own: Walked = rotatedAncestor === undefined ? { node } : { node, rotatedAncestor };
    if (node.kind !== 'box') return [own];
    const next = node.css.rotate !== 0 ? { path: node.path, rotate: node.css.rotate } : rotatedAncestor;
    return [own, ...nodesOf(node.children, next)];
  });

const slideDiagnostics = (slide: PositionedSlide, index: number, size: string): readonly Diagnostic[] => {
  const owners: readonly { readonly path: string; readonly notes: readonly NotEmitted[] }[] = [
    { path: slide.path, notes: slide.css.notEmitted },
    ...nodesOf(slide.children).map((walked) => ({
      path: walked.node.path,
      notes: [...walked.node.css.notEmitted, ...contextualOf(walked.node), ...rotationNotes(walked)],
    })),
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

import { describe, expect, it } from 'vitest';
import { cutLineOf, offsetAfterLines, splitRunsAt } from '../../src/fit/text-split.ts';
import { B, Box, Deck, Slide, Text } from '../../src/primitives/index.ts';
import { resolveDeck } from '../../src/resolve/index.ts';
import { createContext, resolveSize } from '../../src/sizes.ts';
import type { PositionedNode, PositionedText, SlideElement, TextRun } from '../../src/core/types.ts';
import { build } from '../helpers/build.tsx';

const run = (text: string, weight: TextRun['weight'] = 'regular'): TextRun => ({ text, weight, italic: false, color: '#000000' });

describe('M13-5 — corte por linhas', () => {
  it('offsetAfterLines alinha pelos caracteres visíveis (espaços repetidos, NBSP, \\n)', () => {
    const content = 'um  dois tres\nquatro cinco seis';
    expect(offsetAfterLines(content, ['um dois', 'tres', 'quatro cinco', 'seis'], 1)).toBe(8);
    expect(offsetAfterLines(content, ['um dois', 'tres', 'quatro cinco', 'seis'], 2)).toBe(13);
    expect(offsetAfterLines(content, ['um dois', 'tres', 'quatro cinco', 'seis'], 3)).toBe(26);
  });

  it('splitRunsAt preserva estilos e tira o espaço/\\n da fronteira', () => {
    const { head, tail } = splitRunsAt([run('um '), run('dois tres', 'bold'), run('\nquatro')], 7);
    expect(head).toEqual([run('um '), run('dois', 'bold')]);
    expect(tail).toEqual([run('tres', 'bold'), run('\nquatro')]);
    expect(splitRunsAt([run('a\n\nb')], 1).tail).toEqual([run('b')]);
  });

  const paragraphs = (...sizes: number[]) => sizes.map((size) => Array.from({ length: size }, (_, i) => `l${i}`));

  it('cutLineOf: fim de parágrafo se a parte ficar ao menos meio cheia', () => {
    expect(cutLineOf(paragraphs(4, 6, 5), 12)).toBe(10);
    expect(cutLineOf(paragraphs(4, 6, 5), 15)).toBe(15);
  });

  it('cutLineOf: dentro do parágrafo com 2 linhas de cada lado; parágrafo curto começa na próxima parte', () => {
    // fim de parágrafo em 2 < 12/2: corta dentro do de 20 linhas, em 12.
    expect(cutLineOf(paragraphs(2, 20), 12)).toBe(12);
    // sobraria 1 linha do parágrafo [3..13] na próxima parte: recua para deixar 2.
    expect(cutLineOf(paragraphs(2, 11), 12)).toBe(11);
    // parágrafo de 3 linhas [5..7] não divide em 2 + 2: o fim de parágrafo em 4 vale (≥ 6/2).
    expect(cutLineOf(paragraphs(1, 3, 3), 6)).toBe(4);
    // fim de parágrafo longe (1 < 7/2) e o parágrafo [2..9] cortado em 7 deixa 2 depois: corta em 7.
    expect(cutLineOf(paragraphs(1, 8), 7)).toBe(7);
    // [2..4] não dá 2 + 2 e o fim em 1 é pouco: começa o parágrafo na próxima parte (corte em 1).
    expect(cutLineOf(paragraphs(1, 3, 10), 3)).toBe(1);
  });
});

const ctx = createContext(resolveSize('16x9'));

const LONG = Array.from({ length: 8 }, (_, p) =>
  `Parágrafo ${p + 1}: ${'um texto corrido que ocupa algumas linhas no slide para testar a continuação '.repeat(2)}fim ${p + 1}.`,
).join('\n');

const textsOf = (nodes: readonly PositionedNode[]): readonly PositionedText[] =>
  nodes.flatMap((node) => (node.kind === 'text' ? [node] : node.kind === 'box' ? textsOf(node.children) : []));

describe('M13-5 — Text paginate de ponta a ponta', () => {
  const deck = (paginate: boolean) => (
    <Deck>
      <Slide padding={30} gap={10}>
        <Text fontSize={24} fontWeight="bold">Título fixo</Text>
        <Text paginate={paginate} flex={1} fontSize={16}>Começo em <B>negrito</B>. {LONG}</Text>
        <Text fontSize={10}>Rodapé</Text>
      </Slide>
    </Deck>
  );

  it('divide em partes com título e rodapé repetidos, sem encolher, com slide-continued (linhas)', async () => {
    const { positioned, diagnostics } = await build(deck(true));
    expect(positioned.slides.length).toBeGreaterThan(1);
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const notice = diagnostics.find((d) => d.code === 'slide-continued');
    expect(notice?.data).toMatchObject({ kind: 'text', parts: positioned.slides.length });
    expect(notice?.message).toMatch(/linhas no 1º/);
    positioned.slides.forEach((slide) => {
      const [title, body, footer] = textsOf(slide.children);
      expect(title!.content).toBe('Título fixo');
      expect(footer!.content).toBe('Rodapé');
      expect(body!.text.fontSize).toBe(16);
      expect(body!.path).toBe('Slide > Text[1]');
    });
    // O texto inteiro está nas partes, na ordem, sem perder caracteres visíveis.
    const visible = (text: string) => text.replace(/\s+/g, '');
    const joined = positioned.slides.map((slide) => textsOf(slide.children)[1]!.content).join(' ');
    expect(visible(joined)).toBe(visible(`Começo em negrito. ${LONG}`));
    // Estilo preservado: o negrito só existe na 1ª parte.
    expect(textsOf(positioned.slides[0]!.children)[1]!.runs.some((r) => r.weight === 'bold')).toBe(true);
  });

  it('sem paginate não pagina: encolhe e estoura no mesmo slide', async () => {
    const { diagnostics, positioned } = await build(deck(false));
    expect(positioned.slides).toHaveLength(1);
    expect(diagnostics.some((d) => d.code === 'text-overflow' || d.code === 'text-shrunk')).toBe(true);
    expect(diagnostics.some((d) => d.code === 'slide-continued')).toBe(false);
  });

  it('dois nós paginate (Box e Text) → ResolveError; absoluto e maxLines também', () => {
    const resolve = (node: unknown) => resolveDeck((<Deck><Slide>{node as never}</Slide></Deck>) as SlideElement, ctx);
    expect(() => resolve(<><Box paginate /><Text paginate>x</Text></>)).toThrow(/Só um nó paginate/);
    expect(() => resolve(<Text paginate position="absolute">x</Text>)).toThrow(/position="absolute"/);
    expect(() => resolve(<Text paginate maxLines={3}>x</Text>)).toThrow(/maxLines/);
  });
});

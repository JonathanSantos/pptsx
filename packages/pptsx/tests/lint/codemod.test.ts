import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import typescript from 'typescript-api';
import { describe, expect, it } from 'vitest';
import { migrateSource } from '../../src/lint/codemod.ts';

// O default do pacote CJS e o namespace tipado são o mesmo objeto em tempo de execução.
const ts = typescript as unknown as Parameters<typeof migrateSource>[0];
import { render } from '../../src/render.ts';
import type { DeckDefinition, PositionedNode } from '../../src/core/types.ts';

// M16-5: o codemod do `pptsx lint --fix`.
const head = "import { Box, Slide, Text, Image, Span, Table } from 'pptsx';\n";
const fix = (body: string) => migrateSource(ts, 'deck.tsx', head + body);
const out = (body: string) => fix(body).source.slice(head.length);

describe('migrateSource — cada alias', () => {
  it.each([
    ['<Box direction="row" />', '<Box display="flex" />'],
    ['<Box display="flex" direction="row" />', '<Box display="flex" flexDirection="row" />'],
    ['<Box direction="column" />', '<Box flexDirection="column" />'],
    ['<Slide direction="row" />', '<Slide flexDirection="row" />'],
    ['<Box align="start" justify="between" />', '<Box alignItems="flex-start" justifyContent="space-between" />'],
    ['<Text align="center">x</Text>', '<Text textAlign="center">x</Text>'],
    ['<Box grow={1} shrink={0} />', '<Box flex={1} flexShrink={0} />'],
    ['<Box fill="#FFF" radius={8} />', '<Box backgroundColor="#FFF" borderRadius={8} />'],
    ['<Box stroke="#CCC" strokeWidth={2} />', '<Box outline="2px solid #CCC" />'],
    ['<Box stroke="#CCC" />', '<Box outline="1px solid #CCC" />'],
    ['<Slide background="#112233" />', '<Slide backgroundColor="#112233" />'],
    ["<Slide background={{ image: 'a.png' }} />", '<Slide backgroundImage="url(a.png)" />'],
    ['<Text size={20} weight="bold" italic font="Inter">x</Text>', '<Text fontSize={20} fontWeight="bold" fontStyle="italic" fontFamily="Inter">x</Text>'],
    ['<Text italic={false}>x</Text>', '<Text>x</Text>'],
    ['<Span weight="bold">x</Span>', '<Span fontWeight="bold">x</Span>'],
    ['<Image src="a.png" fit="cover" />', '<Image src="a.png" objectFit="cover" />'],
    ['<Table size={12} columns={c} rows={r} />', '<Table fontSize={12} columns={c} rows={r} />'],
  ])('%s', (input, expected) => {
    expect(out(input)).toBe(expected);
  });

  it('renomeia mesmo com valor em expressão ou responsivo quando a troca é só de nome', () => {
    expect(out('<Text size={{ base: 20, tall: 24 }} weight={w}>x</Text>')).toBe('<Text fontSize={{ base: 20, tall: 24 }} fontWeight={w}>x</Text>');
  });

  it('não toca em componentes nem em tags que não vêm de pptsx', () => {
    const source = "import { Bullets } from './c.ts';\nimport { Box as B2 } from 'outra';\n<Bullets size={20} /><B2 fill=\"#fff\" />";
    expect(migrateSource(ts, 'deck.tsx', source)).toEqual({ source, changes: 0, skipped: [] });
  });

  it('respeita o nome local do import (Box as Caixa)', () => {
    expect(migrateSource(ts, 'deck.tsx', "import { Box as Caixa } from 'pptsx';\n<Caixa fill=\"#fff\" />").source).toContain('<Caixa backgroundColor="#fff" />');
  });

  it('valor que muda e não é literal fica, com aviso e linha; conflito com a prop CSS também', () => {
    const result = fix('<Box\n  justify={j}\n  size={1}\n/>\n<Text size={20} fontSize={22}>x</Text>');
    expect(result.skipped).toEqual([
      expect.objectContaining({ line: 3, prop: 'justify' }),
      expect.objectContaining({ line: 6, prop: 'size', reason: expect.stringContaining('já tem fontSize') }),
    ]);
    expect(result.source).toContain('justify={j}');
  });
});

const framesOf = (nodes: readonly PositionedNode[]): readonly (readonly [string, number, number, number, number])[] =>
  nodes.flatMap((node) => [[node.path, node.frame.x, node.frame.y, node.frame.width, node.frame.height] as const, ...(node.kind === 'box' ? framesOf(node.children) : [])]);

describe('--fix em broken-original.tsx', () => {
  it('migra tudo e gera a mesma árvore (frames ±1 pt em 16x9 e 4x3)', async () => {
    // Cópia congelada (M17): usa os layouts/componentes de tests/examples/legacy, não o DS.
    const original = resolve(import.meta.dirname, '../examples/legacy/broken-original.tsx');
    const result = migrateSource(ts, original, readFileSync(original, 'utf8'));
    expect(result.skipped).toEqual([]);
    expect(result.changes).toBeGreaterThan(0);
    // Na mesma pasta do original: os imports relativos continuam valendo.
    const dir = resolve(import.meta.dirname, '../examples/legacy');
    const migrated = join(dir, `tmp-migrated-${process.pid}.tsx`);
    writeFileSync(migrated, result.source);
    try {
      const load = async (file: string) => ((await import(pathToFileURL(file).href)) as { default: DeckDefinition }).default;
      const [before, after] = await Promise.all([original, migrated].map(async (file) => render(await load(file), { sizes: ['16x9', '4x3'], preview: false, includePositioned: true })));
      before!.forEach((size, index) => {
        const a = size.positioned!.slides.flatMap((slide) => framesOf(slide.children));
        const b = after![index]!.positioned!.slides.flatMap((slide) => framesOf(slide.children));
        expect(b.map(([path]) => path)).toEqual(a.map(([path]) => path));
        a.forEach(([, ...frame], i) => frame.forEach((value, k) => expect(Math.abs(value - (b[i]![k + 1] as number))).toBeLessThanOrEqual(1)));
      });
    } finally {
      rmSync(migrated, { force: true });
    }
  }, 60000);
});

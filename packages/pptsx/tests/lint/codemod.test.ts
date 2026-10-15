import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import typescript from 'typescript-api';
import { describe, expect, it } from 'vitest';
import { migrateSource } from '../../src/lint/codemod.ts';

// O default do pacote CJS e o namespace tipado são o mesmo objeto em tempo de execução.
const ts = typescript as unknown as Parameters<typeof migrateSource>[0];

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
    // grow={0} era basis auto; flex={0} do CSS zeraria o item.
    ['<Box grow={0} />', '<Box flexGrow={0} />'],
    ['<Text grow={compact ? 1 : 0}>x</Text>', '<Text flex={compact ? 1 : "0 1 auto"}>x</Text>'],
    ['<Box direction={d} />', '<Box display="flex" flexDirection={d} />'],
    ['<Box stroke={c} strokeWidth={2} />', '<Box outline={`2px solid ${c}`} />'],
    ["<Box justify={x ? 'between' : 'end'} />", '<Box justifyContent={x ? "space-between" : "flex-end"} />'],
    ['<Slide background={color.white} />', '<Slide background={color.white} />'],
    ['<Box fill="#FFF" radius={8} />', '<Box backgroundColor="#FFF" borderRadius={8} />'],
    ['<Box stroke="#CCC" strokeWidth={2} />', '<Box outline="2px solid #CCC" />'],
    ['<Box stroke="#CCC" />', '<Box outline="1px solid #CCC" />'],
    ['<Slide background="#112233" />', '<Slide backgroundColor="#112233" />'],
    ["<Slide background={{ image: 'a.png' }} />", '<Slide backgroundImage="url(a.png)" />'],
    ['<Text size={20} weight="bold" italic font="Inter">x</Text>', '<Text fontSize={20} fontWeight="bold" fontStyle="italic" fontFamily="Inter">x</Text>'],
    ['<Text italic={false}>x</Text>', '<Text fontStyle="normal">x</Text>'],
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

  it('grow em expressão fica, com aviso (o valor decide entre flex={n} e flexGrow={0})', () => {
    expect(fix('<Box grow={g} />').skipped).toEqual([expect.objectContaining({ prop: 'grow', reason: expect.stringContaining('flex="0 1 auto"') })]);
  });

  it('isPptsxModule: primitivas de outro módulo (os testes do repo importam de src/)', () => {
    const source = "import { Box } from '../../src/index.ts';\n<Box fill=\"#fff\" />";
    expect(migrateSource(ts, 'deck.tsx', source).changes).toBe(0);
    expect(migrateSource(ts, 'deck.tsx', source, { isPptsxModule: (spec) => spec.endsWith('src/index.ts') }).source).toContain('backgroundColor="#fff"');
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

// M18-6: a cópia 0.x de tests/examples/legacy fica em fixtures/legacy-0x (.txt, fora do typecheck). O codemod
// sobre ela dá exatamente os arquivos migrados, salvo os três trechos ambíguos que ele avisa e foram à mão;
// as fixtures de paridade (engine-parity, emit-parity) provam que os frames não mudaram.
const LEGACY_0X = resolve(import.meta.dirname, 'fixtures/legacy-0x');
const LEGACY = resolve(import.meta.dirname, '../examples/legacy');
const HAND_MIGRATED: Readonly<Record<string, readonly string[]>> = {
  'components/TwoColumn.tsx': ['grow', 'grow'],
  'layouts/ContentLayout.tsx': ['justify'],
};

const filesOf = (dir: string, prefix = ''): readonly string[] =>
  readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesOf(dir, join(prefix, entry.name)) : entry.name.endsWith('.txt') ? [join(prefix, entry.name).split(sep).join('/')] : [],
  );

describe('--fix / --from 0.x em tests/examples/legacy', () => {
  const sources = filesOf(LEGACY_0X).map((file) => file.replace(/\.txt$/, ''));

  it('a cópia 0.x cobre todos os arquivos de legacy/', () => {
    expect(sources.length).toBeGreaterThan(10);
    sources.forEach((file) => expect(existsSync(join(LEGACY, file)), file).toBe(true));
  });

  it.each(sources)('%s', (file) => {
    const result = migrateSource(ts, file, readFileSync(join(LEGACY_0X, `${file}.txt`), 'utf8'));
    expect(result.skipped.map((skip) => skip.prop)).toEqual(HAND_MIGRATED[file] ?? []);
    if (HAND_MIGRATED[file] === undefined) expect(result.source).toBe(readFileSync(join(LEGACY, file), 'utf8'));
  });
});

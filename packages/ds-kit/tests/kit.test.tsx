import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Box, Deck, Slide, Text, lintDeckForTests } from './helpers.ts';
import {
  catalog, checkTheme, colorsFromTokens, contrastOf, createDs, createVariants, defineComponent, defineTokens, filledSlots,
  maxChildren, onlyOnSlide, slot, themeOf, type ComponentFixture,
} from '@pptsx/ds-kit';

const tokens = defineTokens({
  color: { ink: '#1b2a4a', paper: 'white', accent: '#2F6FED', soft: 'rgb(232, 238, 252)' },
  font: { body: 20, small: 14 },
});

describe('defineTokens', () => {
  it('normaliza e congela as cores; tokenAt e scale', () => {
    expect(tokens.color.paper).toBe('#FFFFFF');
    expect(tokens.color.soft).toBe('#E8EEFC');
    expect(Object.isFrozen(tokens.color)).toBe(true);
    expect(tokens.tokenAt('font.small')).toBe(14);
    expect(tokens.scale('font.body', 1.23)).toBe(24.5);
    expect(() => defineTokens({ color: { x: 'azulado' } })).toThrow(/color\.x não é uma cor/);
    expect(() => tokens.tokenAt('font.huge')).toThrow(/não existe/);
  });
});

describe('themeOf e checkTheme', () => {
  it('slots por caminho de token ou cor direta; contraste abaixo do AA vira aviso', () => {
    const theme = themeOf(tokens, { colors: { dark1: 'color.ink', light1: 'color.paper', accent1: 'color.accent', accent2: '#FFE066' }, fonts: { heading: 'Arial', body: 'Arial' } });
    expect(theme.colors).toMatchObject({ dark1: '#1B2A4A', light1: '#FFFFFF', accent2: '#FFE066' });
    expect(contrastOf('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    const warnings = checkTheme(theme);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/accent2 \(#FFE066\) sobre light1/);
  });
});

describe('createVariants', () => {
  const card = createVariants({
    base: { padding: 12, backgroundColor: tokens.color.soft },
    variants: {
      tone: { neutral: {}, accent: { backgroundColor: tokens.color.accent, color: tokens.color.paper } },
      size: { sm: { padding: 8, fontSize: 14 }, md: { padding: 12, fontSize: 18 }, lg: { padding: 16, fontSize: 22 } },
    },
    defaults: { tone: 'neutral', size: 'md' },
  });

  it('base < variantes; padrões quando não escolhidas', () => {
    expect(card()).toEqual({ padding: 12, backgroundColor: '#E8EEFC', fontSize: 18 });
    expect(card({ tone: 'accent', size: 'sm' })).toEqual({ padding: 8, backgroundColor: '#2F6FED', color: '#FFFFFF', fontSize: 14 });
  });

  it('escolha responsiva vira props responsivas com os mesmos breakpoints', () => {
    expect(card({ size: { base: 'md', tall: 'lg' } })).toEqual({ padding: { base: 12, tall: 16 }, backgroundColor: '#E8EEFC', fontSize: { base: 18, tall: 22 } });
    expect(() => card({ size: 'xl' as never })).toThrow(/size="xl" não existe; use sm, md, lg/);
  });
});

describe('slots', () => {
  it('fallback e slots preenchidos', () => {
    expect(slot(undefined, 'x')).toBe('x');
    expect(slot(false, 'x')).toBe('x');
    expect(filledSlots({ header: 'a', body: null }, ['header', 'body', 'aside'])).toEqual(['header']);
  });
});

// Componente de teste do kit.
const Stat = defineComponent(
  { name: 'Stat', catalog: [{ name: 'curto', props: { label: 'Receita', value: '52' } }, { name: 'longo', props: { label: 'Clientes ativos no período', value: '1,28 mi' } }] },
  ({ label, value }: { label: string; value: string }) => (
    <Box padding={12} backgroundColor={tokens.color.soft} gap={4}>
      <Text fontSize={14} color={tokens.color.ink}>{label}</Text>
      <Text fontSize={32} fontWeight="bold" color={tokens.color.ink}>{value}</Text>
    </Box>
  ),
);
const Row = defineComponent('Row', ({ children }: { children?: unknown }) => <Box display="flex" gap={8}>{children as never}</Box>);

describe('regras', () => {
  it('colorsFromTokens acusa hex solto; maxChildren e onlyOnSlide pelo nome do componente', async () => {
    const deck = () => (
      <Deck>
        <Slide><Text color="#123456">fora</Text><Stat label="a" value="1" /></Slide>
        <Slide><Row>{['1', '2', '3'].map((n) => <Text color={tokens.color.ink}>{n}</Text>)}</Row><Stat label="b" value="2" /></Slide>
      </Deck>
    );
    const findings = await lintDeckForTests(deck, [
      colorsFromTokens('kit/cores', tokens),
      maxChildren('kit/row-max-2', 'Row', 2),
      onlyOnSlide('kit/stat-no-1', 'Stat', 1),
    ]);
    expect(findings.map((f) => [f.code, f.slide, f.path])).toEqual([
      ['kit/cores', 1, 'Slide > Text'],
      ['kit/row-max-2', 2, 'Slide > Row'],
      ['kit/stat-no-1', 2, 'Slide > Stat'],
    ]);
    expect(findings[0]!.message).toContain('#123456');
  });
});

describe('createDs e catalog', () => {
  const ds = createDs({ name: '@teste/kit', version: '0.0.1', components: [Stat, Row], guide: [{ title: 'Stat', markdown: 'Número com rótulo.' }] });

  it('manifesto com os metas (ds preenchido), guia em seções e as funções para o catálogo', () => {
    expect(ds.components.map((meta) => [meta.name, meta.ds])).toEqual([['Stat', '@teste/kit'], ['Row', '@teste/kit']]);
    expect(ds.guide).toBe('# @teste/kit\n\n## Stat\n\nNúmero com rótulo.\n');
    expect(ds.implementations).toEqual([Stat, Row]);
    expect(() => createDs({ name: 'x', version: '1', components: [() => null] })).toThrow(/defineComponent/);
  });

  it('grava PNGs, overview e fixtures só dos componentes com catalog; --check passa e pega 2 pt de diferença', async () => {
    const out = mkdtempSync(join(tmpdir(), 'ds-kit-catalog-'));
    const written = await catalog({ ds, out, sizes: ['16x9', '4x3'] });
    expect(written.components).toEqual(['Stat']);
    expect(written.cases).toBe(4);
    expect(written.files.filter((file) => file.endsWith('.png'))).toHaveLength(5);
    const fixtureFile = join(out, 'fixtures', 'Stat.json');
    const fixture = JSON.parse(readFileSync(fixtureFile, 'utf8')) as ComponentFixture;
    expect(Object.keys(fixture)).toEqual(['curto', 'longo']);
    expect(fixture.curto!['4x3']![0]).toMatchObject({ path: 'Slide > Stat', x: 24, y: 24 });
    expect((await catalog({ ds, out, sizes: ['16x9', '4x3'], check: true })).diffs).toEqual([]);
    const moved = { ...fixture, longo: { ...fixture.longo, '16x9': fixture.longo!['16x9']!.map((frame, index) => (index === 1 ? { ...frame, y: frame.y + 2 } : frame)) } };
    writeFileSync(fixtureFile, JSON.stringify(moved));
    const check = await catalog({ ds, out, sizes: ['16x9', '4x3'], check: true });
    expect(check.diffs).toEqual([expect.objectContaining({ component: 'Stat', case: 'longo', size: '16x9', message: expect.stringMatching(/Text\[0\]: y .* → /) })]);
  }, 60000);
});

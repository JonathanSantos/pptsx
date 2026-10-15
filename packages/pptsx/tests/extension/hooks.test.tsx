import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { defineDs } from '../../src/ds.ts';
import { lintDeck } from '../../src/lint/lint.ts';
import type { LintRule } from '../../src/lint/rule.ts';
import { dsArgsOf } from '../../src/mcp/main.ts';
import { createPptsxMcpServer } from '../../src/mcp/server.ts';
import { Box, Deck, Slide, Text, defineComponent } from '../../src/primitives/index.ts';
import { renderFragment } from '../../src/render.ts';
import { resolveDeck } from '../../src/resolve/index.ts';
import { createContext, resolveSize } from '../../src/sizes.ts';
import type { DeckDefinition, ResolvedBox, SlideElement } from '../../src/core/types.ts';

// M17-1: os ganchos para design systems no núcleo.
const ctx = createContext(resolveSize('16x9'));
const resolve = (deck: unknown) => resolveDeck(deck as SlideElement, ctx);

const Card = defineComponent({ name: 'Card', displayName: 'StatCard', ds: 'teste', tags: ['kpi'] }, ({ label, tone }: { label: string; tone?: string }) => (
  <Box padding={8} backgroundColor={tone === 'dark' ? '#000000' : '#EEEEEE'}><Text>{label}</Text></Box>
), { tone: 'light' });

describe('defineComponent', () => {
  it('displayName vai no path; o meta inteiro chega ao nó; defaults preenchem', () => {
    const slide = resolve(<Deck><Slide><Card label="a" /><Card label="b" tone="dark" /></Slide></Deck>).slides[0]!;
    const [a, b] = slide.children as ResolvedBox[];
    expect(a!.path).toBe('Slide > StatCard[0]');
    expect(a!.component).toEqual({ name: 'Card', displayName: 'StatCard', ds: 'teste', tags: ['kpi'], defaults: { tone: 'light' } });
    expect(a!.css.backgroundColor).toBe('#EEEEEE');
    expect(b!.css.backgroundColor).toBe('#000000');
    // Os filhos não herdam a identidade do componente (só o nó que ele gerou).
    expect(a!.children[0]!.component).toBeUndefined();
  });

  it('função anônima embrulhada ganha nome; função comum continua com { name }; primitiva direta, sem component', () => {
    const Wrapped = defineComponent('Wrapped', ((props: { readonly t: string }) => <Text>{props.t}</Text>));
    function Plain() {
      return <Text>p</Text>;
    }
    const slide = resolve(<Deck><Slide><Wrapped t="x" /><Plain /><Text>z</Text></Slide></Deck>).slides[0]!;
    expect(slide.children.map((node) => [node.path, node.component?.name])).toEqual([
      ['Slide > Wrapped', 'Wrapped'],
      ['Slide > Plain', 'Plain'],
      ['Slide > Text', undefined],
    ]);
    expect(() => defineComponent('', () => null)).toThrow(/nome do componente/);
  });
});

describe('LintRule externa', () => {
  const onlyLight: LintRule = {
    id: 'teste/card-light',
    severity: 'warning',
    check: (node, context) =>
      context.component?.name === 'Card' && node.css.backgroundColor === '#000000' ? [{ message: 'Card escuro não é da marca' }] : [],
  };
  const deck = (() => <Deck><Slide><Card label="a" /><Card label="b" tone="dark" /></Slide></Deck>) as DeckDefinition;

  it('roda depois das internas, com code = id e o path do nó; igual nos dois tamanhos sai uma vez', async () => {
    const findings = await lintDeck(deck, { sizes: ['16x9', '4x3'], baseDir: process.cwd(), rules: [onlyLight] });
    expect(findings).toEqual([{ severity: 'warning', code: 'teste/card-light', slide: 1, path: 'Slide > StatCard[1]', message: 'Card escuro não é da marca' }]);
  });

  it('disable desliga o código; regra que lança vira error com o motivo', async () => {
    expect(await lintDeck(deck, { sizes: ['16x9'], baseDir: process.cwd(), rules: [onlyLight], disable: ['teste/card-light'] })).toEqual([]);
    const broken: LintRule = { id: 'teste/quebra', severity: 'info', check: () => { throw new Error('bug'); } };
    const findings = await lintDeck(deck, { sizes: ['16x9'], baseDir: process.cwd(), rules: [broken] });
    expect(findings[0]).toMatchObject({ severity: 'error', code: 'teste/quebra', message: expect.stringContaining('A regra teste/quebra falhou: bug') });
  });
});

describe('renderFragment', () => {
  it('um Box isolado: frames, SVG e (se pedido) PNG, sem gravar nada', async () => {
    const result = await renderFragment(<Card label="isolado" />, { size: '4x3', png: true, widthPx: 360 });
    expect(result.size).toMatchObject({ name: '4x3', width: 720, height: 540 });
    expect(result.slide.children[0]).toMatchObject({ path: 'Slide > StatCard', frame: { x: 24, y: 24, width: 672 } });
    expect(result.svg).toMatch(/^<svg/);
    expect(result.svg).toContain('isolado');
    expect(result.png!.subarray(1, 4).toString()).toBe('PNG');
    expect(result.diagnostics).toEqual([]);
  });
});

describe('defineDs e o MCP agregador', () => {
  const ds = defineDs({
    name: '@teste/ds',
    version: '0.1.0',
    components: [{ name: 'Card' }],
    rules: [],
    guide: '# Guia do DS\n\n## Uso\n\nUse o Card para números.\n\n## Armadilhas\n\nNada.\n',
    schema: { Card: { type: 'object', properties: { label: { type: 'string' } }, required: ['label'] } },
  });

  it('defineDs recusa nome vazio e regra repetida', () => {
    expect(() => defineDs({ ...ds, name: '' })).toThrow(/name/);
    const rule: LintRule = { id: 'x', severity: 'info', check: () => [] };
    expect(() => defineDs({ ...ds, rules: [rule, rule] })).toThrow(/"x" repetida/);
  });

  it('guide e schema com source; o índice do núcleo lista as fontes; fonte desconhecida é erro', async () => {
    const server = createPptsxMcpServer({ cwd: process.cwd(), ds: [ds], guideText: () => '## 1. Núcleo\n\ntexto' }, 'test');
    const client = new Client({ name: 't', version: '1' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(b), client.connect(a)]);
    const call = async (name: string, args: Record<string, unknown>) => (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
    expect((await call('guide', { source: '@teste/ds', section: 'Uso' })).content[0]!.text).toBe('## Uso\n\nUse o Card para números.');
    expect((await call('guide', {})).content[0]!.text).toContain('Outras fontes (passe source): "@teste/ds"');
    expect(JSON.parse((await call('schema', { source: '@teste/ds', primitive: 'card' })).content[0]!.text)).toMatchObject({ required: ['label'] });
    const unknown = await call('guide', { source: 'nao-existe' });
    expect(unknown.isError).toBe(true);
    expect(unknown.content[0]!.text).toContain('"pptsx", "@teste/ds"');
  });

  it('--ds na linha de comando do servidor', () => {
    expect(dsArgsOf(['--ds', '@pptsx/ds-base', '--ds=./meu-ds', 'x'])).toEqual(['@pptsx/ds-base', './meu-ds']);
  });
});

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { guideTool, lintTool, propToJsonSchema, schemaTool } from '../../src/mcp/tools.ts';

// M18-2: lint pelo MCP com as regras de um DS da config do deck; guide/schema descobrindo o DS pelo deck.
const ROOT = resolve(import.meta.dirname, '../..');
const dir = mkdtempSync(join(ROOT, 'examples', 'tmp-mcp-lint-'));
writeFileSync(join(dir, 'ds.ts'), `import { defineDs } from 'pptsx';
export default defineDs({
  name: 'teste-ds', version: '0.0.1', components: [],
  guide: '## Uso\\n\\nNada de rosa.\\n',
  schema: { Card: { type: 'object', properties: { tone: { type: '"a" | "b"' } }, required: [] } },
  rules: [{ id: 'teste-ds/sem-rosa', severity: 'error', check: (node) => node.css.backgroundColor === '#FF00AA' ? [{ message: 'rosa não' }] : [] }],
});
`);
writeFileSync(join(dir, 'pptsx.config.ts'), `import { defineConfig } from 'pptsx';\nimport ds from './ds.ts';\nexport default defineConfig({ ds: [ds] });\n`);
writeFileSync(join(dir, 'deck.tsx'), `import { Box, Deck, Slide, defineDeck } from 'pptsx';\nexport default defineDeck(() => <Deck><Slide><Box height={40} backgroundColor="#FF00AA" /></Slide></Deck>);\n`);
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const ctx = { cwd: ROOT };
const deck = join(dir, 'deck.tsx');

describe('MCP lint e descoberta do DS pelo deck', () => {
  it('lint devolve isError com a regra do DS da config da pasta do deck', async () => {
    const result = await lintTool({ deck }, ctx);
    expect(result.isError).toBe(true);
    const body = (result.content[0] as { text: string }).text;
    expect(body).toContain('teste-ds/sem-rosa');
    expect(body).toContain('DS: teste-ds');
  }, 60_000);

  it('guide e schema acham o DS pelo deck', async () => {
    expect(((await guideTool({ source: 'teste-ds', section: 'Uso', deck }, ctx)).content[0] as { text: string }).text).toContain('Nada de rosa.');
    const card = JSON.parse(((await schemaTool({ source: 'teste-ds', primitive: 'Card', deck }, ctx)).content[0] as { text: string }).text) as { $id: string; properties: { tone: { enum: string[] } } };
    expect(card.$id).toBe('pptsx:schema/teste-ds#/$defs/Card');
    expect(card.properties.tone.enum).toEqual(['a', 'b']);
    const unknown = await guideTool({ source: 'outro', deck }, ctx);
    expect(unknown.isError).toBe(true);
    expect((unknown.content[0] as { text: string }).text).toContain('"pptsx", "teste-ds"');
  }, 60_000);

  it('propToJsonSchema: literais viram enum, tipos simples viram type, o resto fica em x-tsType', () => {
    expect(propToJsonSchema({ type: '"a" | "b"' })).toEqual({ type: 'string', enum: ['a', 'b'], 'x-tsType': '"a" | "b"' });
    expect(propToJsonSchema({ type: 'string | number', examples: [1] })).toEqual({ type: ['string', 'number'], examples: [1], 'x-tsType': 'string | number' });
    expect(propToJsonSchema({ type: 'Responsive<Length>', description: 'd' })).toEqual({ description: 'd', 'x-tsType': 'Responsive<Length>' });
  });
});

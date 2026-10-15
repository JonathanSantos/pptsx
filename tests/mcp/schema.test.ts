import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generateSchema, OUTPUT, schemaSourceOf } from '../../tools/schema/generate.ts';

// O schema do MCP é gerado dos tipos: se as props mudarem sem `npm run schema:generate`, falha aqui.
describe('schema.generated.ts', () => {
  it('está em dia com AuthorPropsMap', () => {
    expect(readFileSync(OUTPUT, 'utf8')).toBe(schemaSourceOf(generateSchema()));
  }, 120000);
});

import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { catalog } from '@pptsx/ds-kit';
import { ds } from '@pptsx/ds-base';

// O contrato visual do DS: cada caso do catálogo bate com fixtures/<Componente>.json (±1 pt).
describe('catálogo do ds-base', () => {
  it('os componentes com casos renderizam como as fixtures', async () => {
    const result = await catalog({ ds, check: true, fixtures: resolve(import.meta.dirname, '../fixtures') });
    expect(result.components).toEqual(['Bullets', 'KpiCard', 'KpiRow', 'TwoColumn']);
    expect(result.cases).toBe(18);
    expect(result.diffs).toEqual([]);
  }, 120_000);
});

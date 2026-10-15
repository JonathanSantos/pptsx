import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { Box, Text } from 'pptsx';
import { catalog, createDs, defineComponent } from '@pptsx/ds-kit';

// M18-3: catálogo também em .pptx — um deck por componente e tamanho, um slide por caso.
const Badge = defineComponent(
  { name: 'Badge', catalog: [{ name: 'um', props: { label: 'Primeiro' } }, { name: 'dois', props: { label: 'Segundo' } }, { name: 'tres', props: { label: 'Terceiro' } }] },
  ({ label }: { label: string }) => <Box padding={8} backgroundColor="#EEEEEE"><Text>{label}</Text></Box>,
);

describe('catalog --pptx', () => {
  it('grava <Componente>.<tamanho>.pptx com um slide por caso; com check também', async () => {
    const out = mkdtempSync(join(tmpdir(), 'ds-kit-pptx-'));
    const ds = createDs({ name: 'pptx-ds', version: '0.0.1', components: [Badge] });
    await catalog({ ds, out, sizes: ['16x9', '4x3'] });
    const result = await catalog({ ds, out, sizes: ['16x9', '4x3'], check: true, pptx: true });
    expect(result.diffs).toEqual([]);
    const decks = result.files.filter((file) => file.endsWith('.pptx'));
    expect(decks.map((file) => file.slice(out.length + 1))).toEqual(['Badge.16x9.pptx', 'Badge.4x3.pptx']);
    const zip = await JSZip.loadAsync(readFileSync(decks[0]!));
    const slides = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
    expect(slides).toHaveLength(3);
    const second = await zip.file('ppt/slides/slide2.xml')!.async('string');
    expect(second).toContain('Segundo');
    expect(second).toContain('Badge · dois');
  }, 60_000);
});

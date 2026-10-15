import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Box, Deck, Text, lintDeck, type DeckDefinition } from 'pptsx';
import { ContentLayout, CoverLayout, KpiRow, ds, tokens } from '@pptsx/ds-base';
import demo from '../examples/demo.tsx';

const lint = (deck: DeckDefinition) => lintDeck(deck, { sizes: ['16x9'], baseDir: resolve(import.meta.dirname, '../examples'), rules: ds.rules });
const ITEM = { label: 'Receita', value: '1' };

describe('regras de marca do ds-base no pptsx lint', () => {
  it('hex fora dos tokens, KpiRow com 5 itens e capa fora do 1º slide', async () => {
    const findings = await lint(() => (
      <Deck>
        <ContentLayout title="Números">
          <Text color="#123456">fora da paleta</Text>
          <KpiRow items={[ITEM, ITEM, ITEM, ITEM, ITEM]} size="sm" />
        </ContentLayout>
        <CoverLayout title="Capa no lugar errado" />
      </Deck>
    ));
    expect(findings.map((f) => [f.code, f.slide, f.path])).toEqual([
      ['ds-base/colors-from-tokens', 1, 'ContentLayout > Box > Text'],
      ['ds-base/kpi-row-max-4', 1, 'ContentLayout > Box > KpiRow'],
      ['ds-base/cover-only-first', 2, 'CoverLayout'],
    ]);
    expect(findings[0]!.message).toContain('#123456');
  });

  it('a demo do DS passa nas regras do próprio DS', async () => {
    expect(await lint(demo)).toEqual([]);
  });

  it('cor dos tokens não é achado', async () => {
    expect(await lint(() => <Deck><ContentLayout title="ok"><Box backgroundColor={tokens.color.surface}><Text color={tokens.color.accent}>ok</Text></Box></ContentLayout></Deck>)).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { lintDeck } from '../../src/lint/lint.ts';
import type { LintRule } from '../../src/lint/rule.ts';
import { Box, Container, Deck, Slide, Text } from '../../src/primitives/index.ts';
import type { DeckDefinition } from '../../src/core/types.ts';

// M19-4: as regras externas rodam sobre o deck com os Containers medidos (`resolveMeasured`).
const SECRET = 'só existe dentro do Container';

const rule: LintRule = {
  id: 'test/container-content',
  severity: 'warning',
  check: (node) => (node.kind === 'text' && node.content === SECRET ? [{ message: 'achei o texto do Container' }] : []),
};

const deck: DeckDefinition = () => (
  <Deck>
    <Slide>
      <Text>fora</Text>
    </Slide>
    <Slide>
      <Box display="flex" flexDirection="row" flex={1}>
        <Box width="30%" />
        <Container flex={1}>{(box) => <Text>{box.width > 0 ? SECRET : 'sem espaço'}</Text>}</Container>
      </Box>
    </Slide>
  </Deck>
);

describe('pptsx lint — Container (M19-4)', () => {
  it('uma regra externa enxerga o nó que só existe dentro da função do Container', async () => {
    const findings = await lintDeck(deck, { sizes: ['16x9'], baseDir: process.cwd(), rules: [rule] });
    expect(findings.filter((finding) => finding.code === rule.id)).toEqual([
      expect.objectContaining({ severity: 'warning', code: rule.id, slide: 2, path: 'Slide > Box > Container > Text', message: 'achei o texto do Container' }),
    ]);
  });
});

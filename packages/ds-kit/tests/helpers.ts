// Primitivas e o lint do núcleo para os testes do kit (só a API pública do pptsx).
export { Box, Deck, Slide, Text } from 'pptsx';
import type { DeckDefinition, LintFinding, LintRule } from 'pptsx';
import { lintDeck } from 'pptsx';

export const lintDeckForTests = (deck: DeckDefinition, rules: readonly LintRule[]): Promise<readonly LintFinding[]> =>
  lintDeck(deck, { sizes: ['16x9'], baseDir: process.cwd(), rules });

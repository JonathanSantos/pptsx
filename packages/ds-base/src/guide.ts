import { readFileSync } from 'node:fs';
import type { GuidePart } from '@pptsx/ds-kit';
import { theme } from './theme.ts';
import { tokens } from './tokens.ts';

// Os .md ficam em guide/ (fora de src/): `../guide/` vale tanto de src/ quanto de dist/.
const read = (name: string): string => readFileSync(new URL(`../guide/${name}.md`, import.meta.url), 'utf8');

// M18-9: o agente virgem do MCP deduziu os nomes dos tokens pelo exemplo; a lista sai dos próprios tokens.
const tokenGroups = (): string =>
  (['color', 'font', 'space'] as const)
    .map((group) => `- \`tokens.${group}\`: ${Object.entries(tokens[group]).map(([key, value]) => `\`${key}\` (${value})`).join(', ')}`)
    .join('\n');

const tokensAndRules = (): string =>
  [
    'Importe `tokens` de `@pptsx/ds-base` (`const { color, font, space } = tokens;`). Cores em hex, `font` e `space` em pt:',
    '',
    tokenGroups(),
    '',
    'Regras que o `pptsx lint` (e o `lint` do MCP) aplica com o DS registrado:',
    '',
    '- `ds-base/colors-from-tokens` (warning): toda cor pintada (fundo, borda, texto, forma) tem de estar em `tokens.color`. O preto padrão do texto também conta: dê `color` no Slide.',
    `- \`ds-base/fonts-from-theme\` (warning): \`fontFamily\` de um Text tem de ser a do tema (${[theme.fonts?.heading, theme.fonts?.body].filter(Boolean).join(', ')}). Tamanho (\`fontSize\` literal ou de \`tokens.font\`) não conta.`,
    '- `ds-base/kpi-row-max-4` (warning): `KpiRow` com no máximo 4 itens.',
    '- `ds-base/cover-only-first` (warning): `CoverLayout` só no slide 1.',
  ].join('\n');

export const guideParts = (): readonly GuidePart[] => [
  { title: 'O que é', markdown: read('intro') },
  { title: 'Tokens e regras', markdown: tokensAndRules() },
  { title: 'Layouts', markdown: read('layouts') },
  ...['Bullets', 'KpiCard', 'KpiRow', 'TwoColumn'].map((name) => ({ title: name, markdown: read(name) })),
];

import { readFileSync } from 'node:fs';
import type { GuidePart } from '@pptsx/ds-kit';

// Os .md ficam em guide/ (fora de src/): `../guide/` vale tanto de src/ quanto de dist/.
const read = (name: string): string => readFileSync(new URL(`../guide/${name}.md`, import.meta.url), 'utf8');

export const guideParts = (): readonly GuidePart[] => [
  { title: 'O que é', markdown: read('intro') },
  { title: 'Layouts', markdown: read('layouts') },
  ...['Bullets', 'KpiCard', 'KpiRow', 'TwoColumn'].map((name) => ({ title: name, markdown: read(name) })),
];

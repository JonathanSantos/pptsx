// Gera src/schema.generated.ts (props dos componentes, para o `schema` do MCP) com o schemaOf do ds-kit.
import { writeFileSync } from 'node:fs';
import { schemaOf } from '@pptsx/ds-kit';

const NAMES = ['Bullets', 'KpiCard', 'KpiRow', 'TwoColumn', 'CoverLayout', 'ContentLayout', 'ClosingLayout'];
const files = ['src/components/index.ts', 'src/layouts/index.ts'];
const parts = await Promise.all(files.map((file) => schemaOf(new URL(`../${file}`, import.meta.url).pathname, NAMES)));
const schema = Object.assign({}, ...parts);
writeFileSync(new URL('../src/schema.generated.ts', import.meta.url),
  `// Gerado por tools/schema.ts (npm run schema). Não edite à mão.\nexport const PROPS_SCHEMA: Readonly<Record<string, unknown>> = ${JSON.stringify(schema, null, 2)};\n`);
console.log(Object.keys(schema).join(', '));

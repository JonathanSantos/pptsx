import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

/**
 * `pptsx-ds init <pasta>` (M18-4): um design system pronto para crescer — tokens, tema, um componente com
 * variante, slot, caso de catálogo e guia, regras (uma pronta e uma `defineRule`), o manifesto, a config e
 * um `tsconfig.json` que estende o do kit (fim do boilerplate de `paths`). O plano é puro; `initDs` grava.
 */

export interface DsScaffoldFile {
  readonly path: string;
  readonly content: string;
}

export interface DsInitOptions {
  /** Nome do DS (o `name` do manifesto e o prefixo das regras); padrão: o nome da pasta. */
  readonly name?: string;
  /** `extends` do tsconfig: o do kit instalado ou, dentro do monorepo, o `tsconfig.monorepo.json`. */
  readonly tsconfigExtends?: string;
}

const KIT_TSCONFIG = '@pptsx/ds-kit/tsconfig.base.json';
const MONOREPO_TSCONFIG = 'tsconfig.monorepo.json';

/** Nome de pacote válido a partir da pasta (minúsculas, sem espaços nem símbolos). */
export const dsNameOf = (dir: string): string => {
  const name = basename(resolve(dir)).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[._-]+|-+$/g, '');
  return name === '' ? 'meu-ds' : name;
};

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

export const dsScaffoldFiles = (dir: string, options: DsInitOptions = {}): readonly DsScaffoldFile[] => {
  const name = options.name ?? dsNameOf(dir);
  return [
    { path: 'tokens.ts', content: `import { defineTokens } from '@pptsx/ds-kit';

/** Tokens do ${name}: cores (normalizadas para '#RRGGBB'), corpos de texto (pt) e espaços (pt). */
export const tokens = defineTokens({
  color: { ink: '#1F2933', muted: '#52606D', paper: '#FFFFFF', soft: '#EEF2FF', brand: '#2F5BD3' },
  font: { title: 32, body: 18, small: 13 },
  space: { page: 40, gap: 16 },
});
` },
    { path: 'theme.ts', content: `import { themeOf } from '@pptsx/ds-kit';
import { tokens } from './tokens.ts';

/** O tema do arquivo PPTX (seletor de cores do PowerPoint): cada slot aponta um token. */
export const theme = themeOf(tokens, {
  name: '${name}',
  colors: { dark1: 'color.ink', light1: 'color.paper', dark2: 'color.muted', light2: 'color.soft', accent1: 'color.brand' },
  fonts: { heading: 'Arial', body: 'Arial' },
});
` },
    { path: 'components/Card.tsx', content: `import { Box, Text, type Responsive } from 'pptsx';
import { createVariants, defineComponent, slot, type Slots } from '@pptsx/ds-kit';
import { tokens } from '../tokens.ts';

const { color, font, space } = tokens;

// Variantes tipadas: um nome CSS errado aqui não compila.
const box = createVariants({
  base: { borderRadius: 8, gap: 6 },
  variants: {
    tone: { quiet: { backgroundColor: color.soft, color: color.ink }, strong: { backgroundColor: color.brand, color: color.paper } },
    size: { md: { padding: space.gap }, lg: { padding: space.gap * 1.5 } },
  },
  defaults: { tone: 'quiet', size: 'md' },
});

export interface CardProps extends Slots<'footer'> {
  readonly title: string;
  readonly text?: string;
  readonly tone?: 'quiet' | 'strong';
  /** Aceita responsivo: \`{ base: 'md', tall: 'lg' }\`. */
  readonly size?: Responsive<'md' | 'lg'>;
}

export const Card = defineComponent(
  {
    name: 'Card',
    guide: '\`<Card title text? tone? size? footer? />\` — cartão com título e texto. \`tone\`: quiet | strong; \`size\`: md | lg (responsivo); \`footer\` é um slot.',
    catalog: [
      { name: 'quiet', props: { title: 'Receita', text: 'Cresceu 14% sobre o trimestre anterior.' } },
      { name: 'strong-lg', props: { title: 'Meta batida', text: 'Pelo terceiro trimestre seguido.', tone: 'strong', size: 'lg' } },
    ],
  },
  ({ title, text, tone, size, footer }: CardProps) => (
    <Box {...box({ tone, size })}>
      <Text fontSize={font.body} fontWeight="bold">{title}</Text>
      {text === undefined ? null : <Text fontSize={font.small}>{text}</Text>}
      {slot(footer)}
    </Box>
  ),
);
` },
    { path: 'components/index.ts', content: `export { Card, type CardProps } from './Card.tsx';\n` },
    { path: 'rules.ts', content: `import { colorsFromTokens, defineRule } from '@pptsx/ds-kit';
import { tokens } from './tokens.ts';

/** Regras do ${name} no \`pptsx lint\` (ids com o prefixo do DS). */
export const rules = [
  // Pronta: toda cor pintada tem que estar nos tokens.
  colorsFromTokens('${name}/cores', tokens),
  // Própria: um Card sem título não diz nada.
  defineRule('${name}/card-com-titulo', 'warning', (node, ctx) =>
    ctx.component?.name === 'Card' && node.kind === 'box' && node.children[0]?.kind === 'text' && node.children[0].content.trim() === ''
      ? [{ message: 'Card sem título: dê um title curto.' }]
      : []),
];
` },
    { path: 'guide.ts', content: `// Visão geral do guia (markdown); cada componente traz a própria seção no \`guide\` do meta.
export const overview = \`O ${name} é um design system sobre o pptsx. Importe de \\\`./index.ts\\\` (tokens, tema, componentes) e registre \\\`ds\\\` e \\\`theme\\\` no \\\`pptsx.config.ts\\\` do deck.

Regras: \\\`${name}/cores\\\` (cor fora dos tokens) e \\\`${name}/card-com-titulo\\\`.
\`;
` },
    { path: 'ds.ts', content: `import { componentGuides, createDs } from '@pptsx/ds-kit';
import { Card } from './components/index.ts';
import { overview } from './guide.ts';
import { rules } from './rules.ts';
import { theme } from './theme.ts';

const components = [Card];

/** O manifesto: regras no \`pptsx lint\`, guia e schema no MCP, casos no catálogo. */
export const ds = createDs({
  name: '${name}',
  version: '0.1.0',
  components,
  theme,
  rules,
  guide: [{ title: 'Visão geral', markdown: overview }, ...componentGuides(components)],
});

export default ds;
` },
    { path: 'index.ts', content: `export * from './components/index.ts';
export { tokens } from './tokens.ts';
export { theme } from './theme.ts';
export { rules } from './rules.ts';
export { ds } from './ds.ts';
` },
    { path: 'pptsx.config.ts', content: `import { defineConfig } from 'pptsx';
import { ds } from './ds.ts';
import { theme } from './theme.ts';

// Decks desta pasta (e o catálogo) conhecem o DS: regras no lint, tema no arquivo.
export default defineConfig({ ds: [ds], theme });
` },
    { path: 'package.json', content: json({
      name,
      version: '0.1.0',
      type: 'module',
      exports: { '.': './index.ts' },
      scripts: { catalog: 'pptsx-ds catalog ds.ts --out dist/catalog --fixtures fixtures --pptx', 'catalog:check': 'pptsx-ds catalog ds.ts --check --fixtures fixtures' },
      peerDependencies: { pptsx: '>=1.0.0', '@pptsx/ds-kit': '>=0.2.0' },
    }) },
    { path: 'tsconfig.json', content: json({ extends: options.tsconfigExtends ?? KIT_TSCONFIG, include: ['**/*.ts', '**/*.tsx'], exclude: ['dist'] }) },
    { path: '.gitignore', content: 'dist/\n' },
  ];
};

/** Dentro deste monorepo (há um `tsconfig.monorepo.json` acima), o tsconfig estende o dele, com os `paths` para o fonte. */
export const tsconfigExtendsFor = (dir: string): string => {
  const search = (current: string): string | undefined => {
    if (existsSync(join(current, MONOREPO_TSCONFIG))) return join(current, MONOREPO_TSCONFIG);
    const parent = dirname(current);
    return parent === current ? undefined : search(parent);
  };
  const found = search(resolve(dir));
  if (found === undefined) return KIT_TSCONFIG;
  const rel = relative(resolve(dir), found).split(sep).join('/');
  return rel.startsWith('.') ? rel : `./${rel}`;
};

export interface DsInitResult {
  readonly dir: string;
  readonly name: string;
  readonly written: readonly string[];
  readonly kept: readonly string[];
  readonly next: readonly string[];
}

/** Grava o DS na pasta; arquivo existente fica, a menos que `force`. */
export const initDs = (dir: string, options: DsInitOptions & { readonly force?: boolean } = {}): DsInitResult => {
  const target = resolve(dir);
  const name = options.name ?? dsNameOf(target);
  const files = dsScaffoldFiles(target, { name, tsconfigExtends: options.tsconfigExtends ?? tsconfigExtendsFor(target) });
  const written: string[] = [];
  const kept: string[] = [];
  files.forEach((file) => {
    const path = join(target, file.path);
    if (existsSync(path) && options.force !== true) {
      kept.push(file.path);
      return;
    }
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, file.content);
    written.push(file.path);
  });
  const rel = relative(process.cwd(), target).split(sep).join('/') || '.';
  const spec = rel.startsWith('.') ? rel : `./${rel}`;
  return {
    dir: target,
    name,
    written,
    kept,
    next: [
      `npx pptsx init --ds ${spec}          # um deck que usa o DS`,
      `npx pptsx-ds catalog ${spec}/ds.ts --out dist/catalog --fixtures ${spec}/fixtures --pptx`,
      'npx pptsx build deck.tsx --size 16x9,4x3',
      'npx pptsx lint deck.tsx',
    ],
  };
};

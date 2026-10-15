import type { Theme } from '../core/types.ts';
import { DECK_FILE, NEXT_COMMAND, type ScaffoldFile } from './scaffold.ts';

/**
 * `pptsx init --ds <pacote|caminho>` (M18-4): o deck inicial usa o design system — um slide por componente
 * exportado com caso de catálogo (as props do primeiro caso), cores do tema do DS — e a config registra o DS
 * e o tema. Só dados; quem carrega o módulo e grava é init.ts.
 */

/** Um componente do DS que o deck mostra: o nome exportado e as props de exemplo. */
export interface DsDeckComponent {
  readonly name: string;
  readonly props: Readonly<Record<string, unknown>>;
}

export interface DsDeckSource {
  /** O especificador que o deck e a config importam (o pacote ou um caminho relativo com extensão). */
  readonly importFrom: string;
  readonly dsName: string;
  /** Como o manifesto sai do módulo: export nomeado `ds` ou o default. */
  readonly dsExport: 'named' | 'default';
  readonly theme?: Theme;
  readonly components: readonly DsDeckComponent[];
  /** `extends` do tsconfig quando o deck fica dentro do monorepo do pptsx (paths para o fonte). */
  readonly tsconfigExtends?: string;
  /** Pasta do DS (relativa ao deck) quando ele é um caminho em .ts/.tsx: entra no `include`. */
  readonly dsDir?: string;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const SAFE_STRING = /^[^"{}<>\\\n]*$/;

const isElement = (value: unknown): boolean => typeof value === 'object' && value !== null && !Array.isArray(value) && ('$$typeof' in value || 'type' in value);

// Um elemento (slot) não vira código: entra um Text com o nome da área, para o autor trocar.
const attributeOf = (name: string, value: unknown): string | undefined => {
  if (value === undefined || !IDENTIFIER.test(name)) return undefined;
  if (isElement(value)) return `${name}={<Text>${name}</Text>}`;
  if (typeof value === 'string' && SAFE_STRING.test(value)) return `${name}="${value}"`;
  if (value === true) return name;
  return `${name}={${JSON.stringify(value)}}`;
};

const componentSlide = (component: DsDeckComponent, slideProps: string): string => {
  const attributes = Object.entries(component.props).flatMap(([name, value]) => {
    const attribute = attributeOf(name, value);
    return attribute === undefined ? [] : [attribute];
  });
  return [
    `    <Slide ${slideProps}>`,
    `      <Text fontSize={24} fontWeight="bold">${component.name}</Text>`,
    `      <${component.name}${attributes.length === 0 ? '' : ` ${attributes.join(' ')}`} />`,
    '    </Slide>',
  ].join('\n');
};

// Fundo e texto vêm do tema do DS (as regras de cor do DS aceitam o que está nos tokens).
const slidePropsOf = (theme: Theme | undefined): string => {
  const background = theme?.colors?.light1;
  const ink = theme?.colors?.dark1;
  return [
    'padding={40}',
    'gap={16}',
    ...(background === undefined ? [] : [`backgroundColor="${background}"`]),
    ...(ink === undefined ? [] : [`color="${ink}"`]),
  ].join(' ');
};

export const dsDeckContent = (source: DsDeckSource): string => {
  const slideProps = slidePropsOf(source.theme);
  const names = source.components.map((component) => component.name);
  const slides =
    source.components.length === 0
      ? [`    <Slide ${slideProps}>\n      <Text fontSize={24}>Nenhum componente do ${source.dsName} tem caso de catálogo.</Text>\n    </Slide>`]
      : source.components.map((component) => componentSlide(component, slideProps));
  return [
    `// Deck criado por \`pptsx init --ds\`: um slide por componente do ${source.dsName}, com as props do catálogo.`,
    `//   ${NEXT_COMMAND}`,
    `//   npx pptsx lint ${DECK_FILE}   (regras do núcleo + as do DS registrado no pptsx.config.ts)`,
    "import { Deck, Slide, Text, defineDeck } from 'pptsx';",
    ...(names.length === 0 ? [] : [`import { ${names.join(', ')} } from '${source.importFrom}';`]),
    '',
    'export default defineDeck(() => (',
    '  <Deck>',
    slides.join('\n\n'),
    '  </Deck>',
    '));',
    '',
  ].join('\n');
};

export const dsConfigContent = (source: DsDeckSource): string => {
  const importLine = source.dsExport === 'named' ? `import { ds } from '${source.importFrom}';` : `import ds from '${source.importFrom}';`;
  const theme = source.theme === undefined ? '' : ', theme: ds.theme';
  return [
    "import { defineConfig } from 'pptsx';",
    importLine,
    '',
    `// O ${source.dsName} no lint (regras) e no arquivo (tema). Outras opções: sizes, lang, fonts, textSafety, lineBreaks.`,
    `export default defineConfig({ ds: [ds]${theme} });`,
    '',
  ].join('\n');
};

// O tsx só aplica o JSX do tsconfig aos arquivos do `include`: um DS em .tsx fora da pasta do deck seria
// compilado no modo clássico ("React is not defined"). No monorepo, `extends` traz os `paths` para o fonte.
const dsTsconfigOf = (base: string, source: DsDeckSource): string => {
  const parsed = JSON.parse(base) as { readonly compilerOptions?: unknown; readonly include?: readonly string[]; readonly exclude?: readonly string[] };
  const include = [...(parsed.include ?? []), ...(source.dsDir === undefined ? [] : [`${source.dsDir}/**/*.ts`, `${source.dsDir}/**/*.tsx`])];
  const head = source.tsconfigExtends === undefined ? { compilerOptions: parsed.compilerOptions } : { extends: source.tsconfigExtends };
  return `${JSON.stringify({ ...head, include, exclude: parsed.exclude ?? ['dist'] }, null, 2)}\n`;
};

/** Troca deck, config e tsconfig do scaffold padrão pelos que usam o DS. */
export const withDs = (files: readonly ScaffoldFile[], source: DsDeckSource): readonly ScaffoldFile[] =>
  files.map((file) => {
    if (file.path === DECK_FILE) return { ...file, content: dsDeckContent(source) };
    if (file.path === 'pptsx.config.ts') return { ...file, content: dsConfigContent(source) };
    if (file.path === 'tsconfig.json') return { ...file, content: dsTsconfigOf(file.content, source) };
    return file;
  });

/** Arquivos que `pptsx init` cria; só dados, o IO fica em init.ts. */
export interface ScaffoldFile {
  /** Relativo ao diretório do projeto, com `/`. */
  readonly path: string;
  readonly content: string;
}

export const DECK_FILE = 'deck.tsx';
export const GITIGNORE_FILE = '.gitignore';
export const TSCONFIG_FILE = 'tsconfig.json';
export const GITIGNORE_ENTRY = 'dist/';

export const NEXT_COMMAND = `npx pptsx build ${DECK_FILE} --size 16x9,4x3`;

const DECK_TEMPLATE = `// Deck criado por \`pptsx init\`. Para gerar dist/deck.16x9.pptx, dist/deck.4x3.pptx e as prévias em PNG:
//   ${NEXT_COMMAND}
// Durante a edição, \`--watch\` refaz o build a cada mudança salva.
import { Box, Deck, Shape, Slide, Text, defineDeck } from 'pptsx';

// O mesmo código serve para todos os tamanhos: valores responsivos ({ base, tall, wide })
// trocam o layout por breakpoint, sem ler ctx. Fonte e cor definidas no Slide descem para os Text.
export default defineDeck(() => (
  <Deck>
    <Slide backgroundColor="#1B2A4A" padding={48} justifyContent="flex-end" gap={16} color="#FFFFFF">
      <Shape kind="rect" width={56} height={6} fill="#F2A541" />
      <Text fontSize={44} fontWeight="bold">
        Meu primeiro deck
      </Text>
      <Text fontSize={20} color="#C9D3E8">
        TSX entra, PPTX editável sai.
      </Text>
    </Slide>

    <Slide backgroundColor="#FFFFFF" padding={48} gap={24} color="#44506A">
      <Text fontSize={32} fontWeight="bold" color="#1B2A4A">
        Como funciona
      </Text>
      <Box display="grid" gridTemplateColumns={{ base: 'repeat(2, minmax(0, 1fr))', tall: 'minmax(0, 1fr)' }} gap={24} flex={1}>
        <Box backgroundColor="#F4F6FA" borderRadius={8} padding={20} gap={8}>
          <Text fontSize={20} fontWeight="bold" color="#2F6FED">
            Layout em CSS
          </Text>
          <Text fontSize={16}>
            Box, Slide e Text usam box model, flexbox e grid: posições e tamanhos são calculados para cada formato.
          </Text>
        </Box>
        <Box backgroundColor="#F4F6FA" borderRadius={8} padding={20} gap={8}>
          <Text fontSize={20} fontWeight="bold" color="#2F6FED">
            Texto que cabe
          </Text>
          <Text fontSize={16}>
            Se o texto não couber, a fonte encolhe; o que não tiver jeito vira diagnóstico com o caminho até o nó.
          </Text>
        </Box>
      </Box>
      <Text fontSize={12} marginTop="auto" color="#8A94A8">
        Rodapé no fim do slide com marginTop="auto".
      </Text>
    </Slide>
  </Deck>
));
`;

const TSCONFIG = {
  compilerOptions: {
    target: 'ES2022',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    strict: true,
    jsx: 'react-jsx',
    jsxImportSource: 'pptsx',
    allowImportingTsExtensions: true,
    noEmit: true,
    skipLibCheck: true,
  },
  include: ['**/*.ts', '**/*.tsx'],
  exclude: ['dist'],
} as const;

const CONFIG_TEMPLATE = `import { defineConfig } from 'pptsx';

// Opções (todas opcionais; flags da CLI vencem a config):
//   sizes: ['16x9', '4x3']            tamanhos gerados quando --size não é passado
//   lang: 'pt-BR'                     idioma do texto (corretor ortográfico do PowerPoint)
//   fonts: [{ family, weight, file }] fontes próprias, caminhos relativos a este arquivo
//   textSafety: 0.97                  folga da quebra de linha (largura usada = disponível * fator)
//   lineBreaks: 'forced' | 'auto'     forced = linhas exatas do layout; auto = o PowerPoint requebra
export default defineConfig({});
`;

export const gitignoreContent = (existing?: string): string => {
  if (existing === undefined) return `${GITIGNORE_ENTRY}\n`;
  if (existing.split(/\r?\n/).some((line) => line.trim() === GITIGNORE_ENTRY || line.trim() === 'dist')) return existing;
  const separator = existing === '' || existing.endsWith('\n') ? '' : '\n';
  return `${existing}${separator}${GITIGNORE_ENTRY}\n`;
};

export const PACKAGE_FILE = 'package.json';

/** Nome de pacote npm válido a partir do nome da pasta (minúsculas, sem espaços nem símbolos). */
export const packageNameOf = (dirName: string): string => {
  const name = dirName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[._-]+|[-]+$/g, '');
  return name === '' ? 'pptsx-deck' : name;
};

// O grafo do pptsx tem top-level await (yoga-layout): o deck só carrega como ESM.
export const packageJsonContent = (dirName: string): string =>
  `${JSON.stringify({ name: packageNameOf(dirName), private: true, type: 'module' }, null, 2)}\n`;

export const COMMONJS_SWITCHED_WARNING =
  'package.json: "type" trocado de "commonjs" para "module" (o pptsx usa top-level await e o deck só carrega como ESM). ' +
  'Se este pacote tem código CommonJS, deixe o deck numa pasta própria com o seu package.json.';

export const unknownTypeWarningOf = (type: unknown): string =>
  `package.json tem "type": ${JSON.stringify(type)}; o deck precisa de "type": "module" (o pptsx usa top-level await). ` +
  'Mantido como está: ajuste à mão.';

export const invalidPackageWarning = 'package.json não é um JSON válido; mantido como está. Adicione "type": "module" à mão.';

export type PackageJsonMerge =
  | { readonly kind: 'write'; readonly content: string; readonly warning?: string }
  | { readonly kind: 'keep' }
  | { readonly kind: 'warn'; readonly warning: string };

const parseObject = (raw: string): Readonly<Record<string, unknown>> | undefined => {
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Sem `type` ou com `"commonjs"` (o que `npm init -y` grava no npm 11) vira `"type": "module"`, preservando
 * as demais chaves; a troca de commonjs avisa. Um `type` desconhecido não é tocado, só avisa.
 */
export const mergePackageJson = (existing: string | undefined, dirName: string): PackageJsonMerge => {
  if (existing === undefined) return { kind: 'write', content: packageJsonContent(dirName) };
  const pkg = parseObject(existing);
  if (!pkg) return { kind: 'warn', warning: invalidPackageWarning };
  if (pkg.type === 'module') return { kind: 'keep' };
  if (pkg.type !== undefined && pkg.type !== 'commonjs') return { kind: 'warn', warning: unknownTypeWarningOf(pkg.type) };
  const content = `${JSON.stringify({ ...pkg, type: 'module' }, null, 2)}\n`;
  return pkg.type === 'commonjs' ? { kind: 'write', content, warning: COMMONJS_SWITCHED_WARNING } : { kind: 'write', content };
};

/** Todos os arquivos do projeto novo, na ordem em que são listados ao usuário. */
export const scaffoldFiles = (dirName: string = 'pptsx-deck'): readonly ScaffoldFile[] => [
  { path: DECK_FILE, content: DECK_TEMPLATE },
  { path: TSCONFIG_FILE, content: `${JSON.stringify(TSCONFIG, null, 2)}\n` },
  { path: 'pptsx.config.ts', content: CONFIG_TEMPLATE },
  { path: 'assets/.gitkeep', content: '' },
  { path: GITIGNORE_FILE, content: gitignoreContent() },
  { path: PACKAGE_FILE, content: packageJsonContent(dirName) },
];

import { componentUsageOf } from '../cli/ds-scaffold.ts';
import type { ComponentMeta } from '../core/types.ts';
import type { DsManifest } from '../ds.ts';
import { propsMarkdown } from './props.ts';
import { SKILL_SCRIPT_CMD, skillScript } from './script.ts';

/**
 * M18-8: a skill do pptsx para agentes — formato Agent Skills (pasta com `SKILL.md`, `references/`,
 * `scripts/`), lida pelo Claude (Claude Code e app) e pelo GitHub Copilot no VS Code. Uma skill, dois
 * destinos: a mesma pasta em `.claude/skills/<nome>/` e `.github/skills/<nome>/`, mais o `.vscode/mcp.json`
 * e o `.mcp.json` que sobem o servidor MCP pelo script. Tudo vem do repo na hora (guia, schema, versão).
 * Se o formato mudar nas ferramentas, só este arquivo muda. Puro: quem grava é a CLI.
 */

export interface SkillFile {
  /** Relativo à pasta de saída, com `/`. */
  readonly path: string;
  readonly content: string;
}

export interface SkillDs {
  readonly manifest: DsManifest;
  /** Como o deck importa o DS (o nome do pacote). */
  readonly importFrom: string;
}

interface RawSchema {
  readonly properties?: Readonly<Record<string, { readonly type?: string; readonly description?: string; readonly examples?: readonly unknown[] }>>;
  readonly required?: readonly string[];
}

export interface SkillOptions {
  readonly version: string;
  /** docs/AGENT_GUIDE.md. */
  readonly guide: string;
  /** O schema das primitivas (o do `schema()` do MCP). */
  readonly schema: Readonly<Record<string, RawSchema>>;
  readonly releaseBase?: string;
  readonly bundleSha256?: string;
  readonly ds?: SkillDs;
  /** Nome da skill (minúsculas, números e hífen); padrão `pptsx`. */
  readonly name?: string;
}

export const SKILL_DESTINATIONS = ['.claude/skills', '.github/skills'] as const;

/** Nome válido de skill a partir do nome de um pacote (`@pptsx/ds-base` → `pptsx-ds-base`). */
export const skillNameOf = (packageName: string): string => {
  const base = packageName.toLowerCase().replace(/^@/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
  return base.startsWith('pptsx') ? base : `pptsx-${base}`.slice(0, 64);
};

const PRIMITIVE_TITLES: Readonly<Record<string, string>> = {
  deck: 'Deck',
  slide: 'Slide',
  box: 'Box',
  text: 'Text',
  span: 'Span (B, I, Sup, Sub)',
  image: 'Image',
  shape: 'Shape',
  chart: 'Chart',
  table: 'Table',
  path: 'Path',
  icon: 'Icon',
  connector: 'Connector',
  slideNumber: 'SlideNumber',
};

const MODEL_DECK = `\`\`\`tsx
import { Box, Deck, Slide, Text, defineDeck } from 'pptsx';

export default defineDeck(() => (
  <Deck>
    <Slide padding={40} gap={16} backgroundColor="#FFFFFF" color="#1F2933">
      <Text fontSize={32} fontWeight="bold">Resultados do trimestre</Text>
      <Box display="grid" gridTemplateColumns={{ base: 'repeat(3, minmax(0, 1fr))', tall: 'minmax(0, 1fr)' }} gap={16} flex={1}>
        <Box backgroundColor="#EEF2FF" borderRadius={8} padding={16} gap={6}>
          <Text fontSize={14} color="#52606D">Receita</Text>
          <Text fontSize={28} fontWeight="bold">R$ 52,4 mi</Text>
        </Box>
      </Box>
      <Text fontSize={11} color="#52606D" marginTop="auto">Fonte: relatório trimestral</Text>
    </Slide>
  </Deck>
));
\`\`\``;

const dsSection = (ds: SkillDs): readonly string[] => [
  `## Design system: ${ds.manifest.name}`,
  '',
  `Este projeto usa o DS \`${ds.importFrom}\`. Instale-o no projeto do deck (\`npm install ${ds.importFrom}\`), copie \`references/pptsx.config.ts\` para a pasta do deck (registra as regras do DS no lint e o tema no arquivo) e prefira os componentes dele às primitivas: \`references/ds.md\` tem cada componente com um exemplo, as props e as regras.`,
  '',
];

export const skillMarkdown = (options: SkillOptions): string => {
  const name = options.name ?? 'pptsx';
  const dsLine = options.ds === undefined ? '' : ` Com o design system ${options.ds.manifest.name}.`;
  return [
    '---',
    `name: ${name}`,
    `description: Cria apresentações PowerPoint (.pptx) editáveis escrevendo os slides em TSX com layout automático (CSS como props, flexbox e grid), com PNG de cada slide para conferir.${dsLine} Use quando pedirem apresentação, slides, deck, pptx, PowerPoint, Keynote ou Google Slides.`,
    '---',
    '',
    `# pptsx ${options.version}: apresentações em TSX`,
    '',
    'Você descreve a **estrutura** dos slides num arquivo `.tsx` e o pptsx calcula o layout, mede o texto com a fonte real e grava um `.pptx` editável, os PNGs de cada slide e os diagnósticos. Não existem coordenadas x/y.',
    '',
    'Todo comando passa pelo script desta skill, sem instalar nada global (ele baixa ou reaproveita o runtime sozinho):',
    '',
    '```sh',
    'node <pasta-desta-skill>/scripts/pptsx.mjs <comando>',
    '```',
    '',
    '## Fluxo (meta: entregar em até 2 builds)',
    '',
    '1. **Pasta do deck:** `node …/scripts/pptsx.mjs init <pasta>` cria um `deck.tsx` de exemplo, `tsconfig.json` e `pptsx.config.ts`. Ou escreva só o `deck.tsx`, como no modelo abaixo: o script compila sem `tsconfig.json` nem `pptsx.config.ts` (a config só é preciso para fontes próprias, tema ou um design system).',
    '2. **Escreva os slides** seguindo as regras abaixo. Antes do primeiro deck, leia `references/essentials.md` (curto: primitivas, texto, paginação, diagnósticos e armadilhas, cabe num Read). O resto está em `references/guide.md` (longo: o índice no topo dá a linha de cada seção; §6 receitas) e `references/props.md` (todas as props, com o tipo).',
    '3. **Compile:** `node …/scripts/pptsx.mjs build <pasta>/deck.tsx --size 16x9` (`--size 16x9,4x3` se pedirem os dois formatos). Os arquivos saem em `dist/` (`--out` muda a pasta).',
    '4. **Leia o resumo:** cada diagnóstico tem o slide, o caminho do nó (`Slide > Box[1] > Text` é o Text do 2º Box do slide) e o que fazer. Abra o overview PNG listado para ver o layout.',
    '5. **Corrija** os `error` (e de preferência os `warning`) e compile de novo.',
    '6. **Entregue** o `.pptx` (o caminho está no resumo) e conte o que sobrou de diagnóstico.',
    '',
    '## Modelo',
    '',
    MODEL_DECK,
    '',
    '## Regras que evitam o segundo build',
    '',
    '- `export default defineDeck((ctx) => <Deck>…</Deck>)`; os filhos do `Deck` são só `Slide`.',
    '- **Todo texto dentro de `<Text>`** (string solta num Box é erro). Negrito e itálico no meio do texto: `<B>`, `<I>`, `<Span color=…>` dentro do Text.',
    '- O layout é **CSS em camelCase** como props: `padding`, `gap`, `margin`, `width`, `height`, `flex`, `alignItems`, `justifyContent`, `backgroundColor`, `border`, `borderRadius`, `fontSize`, `fontWeight`, `color`, `textAlign`, `lineHeight`. Números são pt (o slide 16:9 tem 720 × 405 pt; o 4:3, 720 × 540).',
    '- `Box` sem `display` é **coluna**; `display="flex"` é **linha**. Colunas iguais: `display="grid" gridTemplateColumns="repeat(3, minmax(0, 1fr))"` (sempre `minmax(0, 1fr)`, nunca `1fr` solto) ou `flex={1}` em cada filho de uma linha.',
    '- Ocupar a altura que sobra: `flex={1}`. Rodapé no fim: `marginTop="auto"` no último filho.',
    '- Fonte e cor declaradas no `Slide` ou num `Box` **descem** para os `Text` de dentro: defina uma vez e escreva só o que muda.',
    '- O 4:3 é mais **alto** que o 16:9 (mesma largura). Valor por formato: `{ base: …, tall: … }` (`tall` = 4:3 e 16:10), nunca `if` sobre o formato.',
    '- Lista ou tabela longa: `<Box paginate flex={1}>` (ou `Table paginate`) divide o conteúdo em vários slides; um por slide. Texto que não cabe encolhe até um mínimo e, depois disso, vira `error` com o conserto.',
    '- Gráfico nativo: `<Chart kind="bar" data={{ categories: [...], series: [{ name, values: [...] }] }} labels flex={1} />` (precisa de altura: `flex={1}` ou `height`). Tabela: `<Table columns={[{ header: "Área" }, { header: "Q3", align: "right" }]} rows={[["Varejo", "22,6"]]} />` (números como texto mantêm a vírgula).',
    '- Imagem: `<Image src="./logo.png" width={120} />`, com o caminho relativo ao deck.',
    '- O que o PPTX não tem (gradiente, `overflow: hidden`…) vira o aviso `css-not-emitted`: troque por algo que exista. Não invente props; na dúvida, `references/props.md`.',
    '',
    ...(options.ds === undefined ? [] : dsSection(options.ds)),
    '## Referências',
    '',
    '- `references/essentials.md`: o essencial do guia (≈ 350 linhas): leia inteiro antes do primeiro deck.',
    '- `references/guide.md`: o guia completo (primitivas, texto, receitas, diagnósticos, armadilhas).',
    '- `references/props.md`: as props de cada primitiva, com o tipo.',
    ...(options.ds === undefined ? [] : ['- `references/ds.md`: os componentes, as props e as regras do design system.', '- `references/pptsx.config.ts`: a config que registra o design system.']),
    '- `node …/scripts/pptsx.mjs doctor`: Node, fontes do sistema e cache, se o build nem rodar.',
    '',
  ].join('\n');
};

const firstCaseOf = (meta: ComponentMeta): Readonly<Record<string, unknown>> | undefined => {
  const first: unknown = Array.isArray(meta.catalog) ? meta.catalog[0] : undefined;
  return typeof first === 'object' && first !== null && 'props' in first ? (first.props as Readonly<Record<string, unknown>>) : undefined;
};

const componentSection = (meta: ComponentMeta): string => {
  const props = firstCaseOf(meta);
  return [
    `### ${meta.displayName ?? meta.name}`,
    '',
    ...(typeof meta.guide === 'string' ? [meta.guide.trim(), ''] : []),
    ...(props === undefined ? [] : ['```tsx', componentUsageOf({ name: meta.name, props }), '```', '']),
  ].join('\n');
};

const isPropsSchema = (value: unknown): value is RawSchema => typeof value === 'object' && value !== null && 'properties' in value;

export const dsMarkdown = (ds: SkillDs): string => {
  const { manifest } = ds;
  const schemas = Object.fromEntries(Object.entries(manifest.schema ?? {}).filter((entry): entry is [string, RawSchema] => isPropsSchema(entry[1])));
  const props = Object.keys(schemas).length === 0 ? '' : propsMarkdown('Props dos componentes', schemas).replace(/^# /, '## ');
  return [
    `# ${manifest.name} ${manifest.version}`,
    '',
    `Importe de \`${ds.importFrom}\` (\`import { ${manifest.components.slice(0, 3).map((meta) => meta.name).join(', ')} } from '${ds.importFrom}';\`) e registre o DS no \`pptsx.config.ts\` da pasta do deck (o arquivo pronto está em \`references/pptsx.config.ts\`).`,
    '',
    '## Componentes',
    '',
    ...manifest.components.map(componentSection),
    ...(manifest.rules.length === 0 ? [] : ['## Regras de lint', '', 'O `lint` e o `build` apontam estas regras do DS, com o caminho do nó:', '', ...manifest.rules.map((rule) => `- \`${rule.id}\` (${rule.severity})`), '']),
    ...(manifest.guide === undefined ? [] : ['## Guia do design system', '', manifest.guide.replace(/^# .*\n+/, '').trim(), '']),
    props,
  ].join('\n');
};

export const dsConfigOf = (ds: SkillDs): string =>
  [
    "import { defineConfig } from 'pptsx';",
    `import { ds } from '${ds.importFrom}';`,
    '',
    `// O ${ds.manifest.name} no lint (regras) e no arquivo (tema). Copie para a pasta do deck.`,
    `export default defineConfig({ ds: [ds]${ds.manifest.theme === undefined ? '' : ', theme: ds.theme'} });`,
    '',
  ].join('\n');

const mcpVsCode = (name: string): string =>
  `${JSON.stringify({ servers: { [name]: { type: 'stdio', command: 'node', args: [`\${workspaceFolder}/.github/skills/${name}/scripts/pptsx.mjs`, 'mcp'] } } }, null, 2)}\n`;

const mcpClaudeCode = (name: string): string =>
  `${JSON.stringify({ mcpServers: { [name]: { command: 'node', args: [`.claude/skills/${name}/scripts/pptsx.mjs`, 'mcp'] } } }, null, 2)}\n`;

const readmeOf = (name: string, version: string, releaseBase: string | undefined): string =>
  [
    `# Skill ${name} (pptsx ${version})`,
    '',
    'Gerada por `pptsx skill`. Copie para a raiz do repositório onde o agente vai trabalhar:',
    '',
    `- **Claude Code:** \`.claude/skills/${name}/\` (ou \`~/.claude/skills/${name}/\` para todos os projetos); \`.mcp.json\` sobe o servidor MCP pelo script.`,
    `- **Claude (app):** compacte \`.claude/skills/${name}/\` num .zip e envie em Configurações → Skills.`,
    `- **GitHub Copilot no VS Code (agent mode):** \`.github/skills/${name}/\` e \`.vscode/mcp.json\`.`,
    '',
    'O script (`scripts/pptsx.mjs`, ou `pptsx.cmd` no Windows) precisa só de Node 20.6+. Ele usa o bundle `pptsx.mjs` em cache (`~/.cache/pptsx/<versão>/`), baixa da release conferindo o SHA256 ou cai para `npx pptsx@<versão>`, e nunca instala nada global.',
    '',
    `**Antes da publicação da ${version}** (release no GitHub e pacote no npm) o script não acha o runtime sozinho: aponte \`PPTSX_BUNDLE=/caminho/dist/standalone/pptsx.mjs\` (saída de \`npm run build:standalone\`) ou grave esse arquivo em \`~/.cache/pptsx/${version}/pptsx.mjs\`. Sem isso, o script explica o que falta e sai com código 2.`,
    ...(releaseBase === undefined
      ? ['', 'Esta skill foi gerada **sem `repository` no package.json**: o download da release está desligado; ficam o cache, `PPTSX_BUNDLE` e o `npx`.']
      : []),
    '',
  ].join('\n');

const GUIDE_PREFACE = [
  '> **Na skill:** este é o guia do repositório do pptsx. Caminhos `packages/…`, o MCP e o DS de exemplo `@pptsx/ds-base` (`ContentLayout`, `Bullets`, `tokens`) **não existem no seu projeto**, a menos que a skill traga um DS (`references/ds.md`): nas receitas, troque esses componentes por primitivas (`Slide`, `Box`, `Text`…). Os comandos `npx pptsx …` viram `node <pasta-da-skill>/scripts/pptsx.mjs …`.',
  '',
];

/**
 * O guia com o aviso de contexto e um índice com a linha de cada seção: ele é longo demais para um Read só
 * (achado do agente virgem do M18-8), e o índice deixa ler só a seção que importa.
 */
export const guideReferenceOf = (guide: string): string => {
  const lines = guide.split('\n');
  const headings = lines.flatMap((line, index) => (/^#{2,3} /.test(line) ? [{ line, index }] : []));
  const header = (offset: number): readonly string[] => [
    ...GUIDE_PREFACE,
    '**Índice** (linha de cada seção neste arquivo; leia só a que precisar):',
    '',
    ...headings.map(({ line, index }) => `- linha ${index + 1 + offset}: ${line.replace(/^#+ /, '')}`),
    '',
  ];
  const offset = header(0).length;
  return [...header(offset), ...lines].join('\n');
};

/** Seções do guia que entram no essencial: a `##` e quais `###` dela (`'all'` = todas; `[]` = só a introdução). */
const ESSENTIAL_SECTIONS: readonly { readonly section: RegExp; readonly subs: 'all' | readonly RegExp[] }[] = [
  { section: /^## 1\./, subs: 'all' },
  { section: /^## 2\./, subs: [/^### Breakpoints/] },
  { section: /^## 3\./, subs: [/^### Por primitiva/, /^### Paginação/, /^### Regras de flex e grid/] },
  { section: /^## 4\./, subs: [/^### Rich text/, /^### NBSP/] },
  { section: /^## 8\./, subs: [/^### Como ler o `path`/, /^### Códigos/, /^### Checklist/] },
  { section: /^## 9\./, subs: 'all' },
];

const ESSENTIALS_PREFACE = [
  '# pptsx: o essencial',
  '',
  '> Gerado do guia completo (`references/guide.md`): só o que um agente precisa antes do primeiro deck. Receitas (§6), gráficos, tabelas, diagramas, texto rico avançado, tema do arquivo e design systems ficam no guia; o índice no topo dele dá a linha de cada seção.',
  '',
  ...GUIDE_PREFACE,
];

interface GuideBlock {
  readonly level: number;
  readonly heading: string;
  readonly lines: readonly string[];
}

/** O guia em blocos: cada `##`/`###` com o texto até o próximo cabeçalho de qualquer nível. */
const blocksOf = (guide: string): readonly GuideBlock[] =>
  guide.split('\n').reduce<GuideBlock[]>((blocks, line) => {
    const match = /^(#{2,3}) /.exec(line);
    if (match === null) {
      const last = blocks.at(-1);
      return last === undefined ? blocks : [...blocks.slice(0, -1), { ...last, lines: [...last.lines, line] }];
    }
    return [...blocks, { level: match[1]!.length, heading: line, lines: [line] }];
  }, []);

/**
 * O essencial: as seções de ESSENTIAL_SECTIONS, na ordem do guia. Um `###` entra se a sua `##` pede
 * `'all'` ou se bate com um dos padrões; a introdução da `##` (antes do 1º `###`) entra sempre.
 */
export const essentialsOf = (guide: string): string => {
  const blocks = blocksOf(guide);
  const kept = blocks.flatMap((block, index) => {
    const owner = block.level === 2 ? block : [...blocks.slice(0, index)].reverse().find((candidate) => candidate.level === 2);
    const rule = owner === undefined ? undefined : ESSENTIAL_SECTIONS.find(({ section }) => section.test(owner.heading));
    if (rule === undefined) return [];
    if (block.level === 2 || rule.subs === 'all') return block.lines;
    return rule.subs.some((pattern) => pattern.test(block.heading)) ? block.lines : [];
  });
  return [...ESSENTIALS_PREFACE, ...kept].join('\n').replace(/\n{3,}/g, '\n\n');
};

/** Os arquivos da pasta da skill (sem o destino na frente). */
export const skillFolderFiles = (options: SkillOptions): readonly SkillFile[] => [
  { path: 'SKILL.md', content: skillMarkdown(options) },
  { path: 'references/essentials.md', content: essentialsOf(options.guide) },
  { path: 'references/guide.md', content: guideReferenceOf(options.guide) },
  { path: 'references/props.md', content: propsMarkdown('Props das primitivas do pptsx', options.schema, PRIMITIVE_TITLES) },
  ...(options.ds === undefined ? [] : [{ path: 'references/ds.md', content: dsMarkdown(options.ds) }, { path: 'references/pptsx.config.ts', content: dsConfigOf(options.ds) }]),
  {
    path: 'scripts/pptsx.mjs',
    content: skillScript({
      version: options.version,
      ...(options.releaseBase === undefined ? {} : { releaseBase: options.releaseBase }),
      ...(options.bundleSha256 === undefined ? {} : { bundleSha256: options.bundleSha256 }),
    }),
  },
  { path: 'scripts/pptsx.cmd', content: SKILL_SCRIPT_CMD },
];

/** Tudo o que `pptsx skill --out` grava: a pasta nos dois destinos, os mcp.json e um README. */
export const skillFiles = (options: SkillOptions): readonly SkillFile[] => {
  const name = options.name ?? 'pptsx';
  const folder = skillFolderFiles(options);
  return [
    ...SKILL_DESTINATIONS.flatMap((destination) => folder.map((file) => ({ ...file, path: `${destination}/${name}/${file.path}` }))),
    { path: '.vscode/mcp.json', content: mcpVsCode(name) },
    { path: '.mcp.json', content: mcpClaudeCode(name) },
    { path: 'README.md', content: readmeOf(name, options.version, options.releaseBase) },
  ];
};

import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Box, Text, defineComponent } from '../../src/primitives/index.ts';
import { defineDs } from '../../src/ds.ts';
import { COMPONENT_META } from '../../src/core/types.ts';
import { PROPS_SCHEMA } from '../../src/mcp/schema.generated.ts';
import { createSkillFiles, githubRepoOf, skillFiles, skillNameOf, writeSkill, type SkillFile, type SkillOptions } from '../../src/skill/index.ts';

/** M18-8: a skill gerada por `pptsx skill` (formato Agent Skills, Claude e Copilot) e o script dela. */

const dirs: string[] = [];
const freshDir = (prefix: string): string => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
};
afterAll(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const BASE: SkillOptions = { version: '9.9.9', guide: '# Guia\n\ntexto', schema: PROPS_SCHEMA };
const fileOf = (files: readonly SkillFile[], path: string): string => {
  const file = files.find((item) => item.path === path);
  if (file === undefined) throw new Error(`sem ${path}`);
  return file.content;
};

const frontmatterOf = (markdown: string): Readonly<Record<string, string>> => {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(markdown);
  if (match === null) throw new Error('sem frontmatter');
  return Object.fromEntries(match[1]!.split('\n').map((line) => [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 1).trim()]));
};

const Card = defineComponent(
  { name: 'Card', guide: '`<Card title />` — cartão.', catalog: [{ name: 'um', props: { title: 'Receita', tone: 'strong' } }] },
  ({ title }: { title: string; tone?: string }) => <Box><Text>{title}</Text></Box>,
);
const DS = defineDs({
  name: 'marca',
  version: '1.2.3',
  components: [Card[COMPONENT_META]!],
  rules: [{ id: 'marca/cores', severity: 'warning', check: () => [] }],
  guide: '# marca\n\nUse os tokens.',
  theme: { colors: { accent1: '#2F5BD3' } },
  schema: { Card: { type: 'object', properties: { title: { type: 'string', examples: ['Receita'] } }, required: ['title'] } },
});

describe('skillFiles', () => {
  const files = skillFiles(BASE);

  it('a mesma pasta em .claude/skills e .github/skills, mais os mcp.json e o README', () => {
    const claude = files.filter((file) => file.path.startsWith('.claude/skills/pptsx/')).map((file) => [file.path.replace('.claude/', ''), file.content]);
    const github = files.filter((file) => file.path.startsWith('.github/skills/pptsx/')).map((file) => [file.path.replace('.github/', ''), file.content]);
    expect(claude).toEqual(github);
    expect(claude.map(([path]) => path)).toEqual([
      'skills/pptsx/SKILL.md',
      'skills/pptsx/references/guide.md',
      'skills/pptsx/references/props.md',
      'skills/pptsx/scripts/pptsx.mjs',
      'skills/pptsx/scripts/pptsx.cmd',
    ]);
    expect(JSON.parse(fileOf(files, '.vscode/mcp.json')).servers.pptsx.args).toEqual(['${workspaceFolder}/.github/skills/pptsx/scripts/pptsx.mjs', 'mcp']);
    expect(JSON.parse(fileOf(files, '.mcp.json')).mcpServers.pptsx.args).toEqual(['.claude/skills/pptsx/scripts/pptsx.mjs', 'mcp']);
  });

  it('SKILL.md: frontmatter válido (name, description com os gatilhos) e todo link para references/ existe', () => {
    const skill = fileOf(files, '.claude/skills/pptsx/SKILL.md');
    const front = frontmatterOf(skill);
    expect(front.name).toMatch(/^[a-z0-9-]{1,64}$/);
    expect(front.description!.length).toBeLessThanOrEqual(1024);
    ['apresentação', 'slides', 'deck', 'pptx'].forEach((word) => expect(front.description).toContain(word));
    const links = [...skill.matchAll(/`(references\/[^`]+|scripts\/[^`\s]+)`/g)].map((match) => match[1]!);
    expect(links.length).toBeGreaterThan(2);
    links.forEach((link) => expect(files.some((file) => file.path === `.claude/skills/pptsx/${link}`), link).toBe(true));
    expect(skill).toContain('pptsx 9.9.9');
  });

  it('references: o guia como veio e as props de cada primitiva, geradas do schema', () => {
    const guide = fileOf(files, '.claude/skills/pptsx/references/guide.md');
    expect(guide.endsWith(BASE.guide)).toBe(true);
    expect(guide).toContain('não existem no seu projeto');
    const props = fileOf(files, '.claude/skills/pptsx/references/props.md');
    ['## Slide', '## Box', '## Text', '## Chart', '## Table', '| `paginate` |', '| `gridTemplateColumns` |'].forEach((text) => expect(props).toContain(text));
    expect(props).not.toContain('ResponsiveValue');
  });

  it('com DS: ds.md (componentes com exemplo, regras, guia, props) e a config que o registra', () => {
    const withDs = skillFiles({ ...BASE, name: skillNameOf('@marca/ds'), ds: { manifest: DS, importFrom: '@marca/ds' } });
    const root = '.claude/skills/pptsx-marca-ds';
    const ds = fileOf(withDs, `${root}/references/ds.md`);
    expect(ds).toContain('# marca 1.2.3');
    expect(ds).toContain('<Card title="Receita" tone="strong" />');
    expect(ds).toContain('`marca/cores` (warning)');
    expect(ds).toContain('Use os tokens.');
    expect(ds).toContain('| `title` * | `string` |');
    expect(fileOf(withDs, `${root}/references/pptsx.config.ts`)).toContain("import { ds } from '@marca/ds';");
    expect(fileOf(withDs, `${root}/references/pptsx.config.ts`)).toContain('theme: ds.theme');
    expect(fileOf(withDs, `${root}/SKILL.md`)).toContain('Design system: marca');
  });

  it('o índice do guia aponta a linha certa de cada seção', () => {
    const guide = fileOf(skillFiles({ ...BASE, guide: '# G\n\n## 1. Um\n\ntexto\n\n### Sub\n' }), '.claude/skills/pptsx/references/guide.md');
    const lines = guide.split('\n');
    [...guide.matchAll(/- linha (\d+): (.+)/g)].forEach(([, line, title]) => expect(lines[Number(line) - 1]).toMatch(new RegExp(`^#+ ${title}$`)));
  });

  it('skillNameOf e githubRepoOf', () => {
    expect(skillNameOf('@pptsx/ds-base')).toBe('pptsx-ds-base');
    expect(skillNameOf('Minha Marca')).toBe('pptsx-minha-marca');
    expect(githubRepoOf('github:dono/repo')).toBe('dono/repo');
    expect(githubRepoOf({ url: 'git+https://github.com/dono/repo.git' })).toBe('dono/repo');
    expect(githubRepoOf(undefined)).toBeUndefined();
  });

  it('createSkillFiles lê a versão e o guia do pacote', () => {
    const created = createSkillFiles();
    expect(fileOf(created, '.claude/skills/pptsx/SKILL.md')).toMatch(/# pptsx \d+\.\d+\.\d+/);
    expect(fileOf(created, '.claude/skills/pptsx/references/guide.md')).toContain('# Guia do agente');
  });
});

describe('scripts/pptsx.mjs', () => {
  const install = (options: Partial<SkillOptions> = {}): string => {
    const out = freshDir('pptsx-skill-');
    writeSkill(out, skillFiles({ ...BASE, ...options }));
    return join(out, '.claude', 'skills', 'pptsx', 'scripts', 'pptsx.mjs');
  };
  // PATH vazio: sem npm/npx; cache vazio; sem release configurada.
  const run = (script: string, args: readonly string[], env: NodeJS.ProcessEnv = {}) =>
    spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: { PATH: '', PPTSX_CACHE: freshDir('pptsx-cache-'), ...env } });

  it('é JS válido e responde --help sem procurar runtime', () => {
    const script = install();
    expect(spawnSync(process.execPath, ['--check', script]).status).toBe(0);
    const help = run(script, ['--help']);
    expect(help.status).toBe(0);
    expect(help.stdout).toContain('build <deck.tsx>');
  });

  it('sem cache, sem rede e sem npm: sai com 2 e diz onde gravar o pptsx.mjs', () => {
    const cache = freshDir('pptsx-cache-');
    const result = run(install(), ['build', 'deck.tsx'], { PPTSX_CACHE: cache });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('não achei o runtime do pptsx 9.9.9');
    expect(result.stderr).toContain(join(cache, '9.9.9', 'pptsx.mjs'));
    expect(result.stderr).toContain('npx pptsx@9.9.9');
  });

  it('bundle no cache com SHA256 errado não é usado', () => {
    const cache = freshDir('pptsx-cache-');
    mkdirSync(join(cache, '9.9.9'));
    writeFileSync(join(cache, '9.9.9', 'pptsx.mjs'), 'console.log("adulterado")');
    const result = run(install({ bundleSha256: 'a'.repeat(64) }), ['doctor'], { PPTSX_CACHE: cache });
    expect(result.status).toBe(2);
    expect(result.stdout).not.toContain('adulterado');
  });

  it('PPTSX_BUNDLE aponta o runtime; o build vira o resumo para o modelo', () => {
    const fake = join(freshDir('pptsx-fake-'), 'pptsx.mjs');
    writeFileSync(fake, "console.log(JSON.stringify({ files: ['/x/dist/d.16x9.pptx', '/x/dist/d.16x9.overview.png', '/x/dist/d.16x9/slide-01.png'], diagnostics: [{ size: '16x9', slide: 2, severity: 'error', code: 'text-overflow', path: 'Slide > Text', message: 'Encurte.' }] })); process.exitCode = 1;");
    const result = run(install(), ['build', 'd.tsx'], { PPTSX_BUNDLE: fake });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('/x/dist/d.16x9.pptx');
    expect(result.stdout).toContain('1 PNGs de slide');
    expect(result.stdout).toContain('✖ [16x9 · slide 2] text-overflow em Slide > Text');
    expect(result.stdout).toContain('Corrija os error');
  });
});

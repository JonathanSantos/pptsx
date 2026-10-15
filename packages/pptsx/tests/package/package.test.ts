import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { PACKAGE_TEST_ENABLED as ENABLED, PACKAGE_TIMEOUT as TIMEOUT, describeRun, freshDir, npmInstall as npmInstallAll, npxBin, pack, removeFreshDirs, run } from './helpers.ts';

/**
 * Teste de pacote (M7-E), LENTO: `npm pack` → projeto vazio fora do repo → `npm install <tarball>`
 * → `npx pptsx init` → `npx pptsx build deck.tsx --preview none --out dist`.
 *
 * Fica fora do `npm test`: só roda com PPTSX_PACKAGE_TEST, que o `npm run test:package`
 * (vitest.package.config.ts) define. Precisa de rede ou do cache do npm.
 */

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
/** M18-5: meta do tarball do núcleo (as Liberation vão; a Inter fica no ds-base). */
const MAX_TARBALL_BYTES = 1_500_000;

const npmInstall = (tarball: string, cwd: string) => npmInstallAll([tarball], cwd);
const pptsx = (args: readonly string[], cwd: string) => npxBin('pptsx', args, cwd);

describe.skipIf(!ENABLED)('package — npm pack → install → init → build', () => {
  let tarball = '';
  let packed: readonly string[] = [];

  let size = 0;

  beforeAll(() => {
    ({ tarball, files: packed, size } = pack(ROOT, freshDir('pptsx-pack-')));
  }, TIMEOUT);

  afterAll(removeFreshDirs);

  it('the tarball stays under 1.5 MB and carries LICENSE and THIRD_PARTY.md', () => {
    expect(size).toBeLessThanOrEqual(MAX_TARBALL_BYTES);
    expect(packed).toContain('LICENSE');
    expect(packed).toContain('THIRD_PARTY.md');
  });

  it('the tarball has the compiled engine, the bin and the fonts', () => {
    expect(existsSync(tarball)).toBe(true);
    for (const file of ['package.json', 'bin/pptsx.mjs', 'dist/index.js', 'dist/index.d.ts', 'dist/cli.js']) {
      expect(packed, file).toContain(file);
    }
    expect(packed.some((file) => file.startsWith('dist/jsx/jsx-runtime.'))).toBe(true);
    expect(packed.some((file) => file.startsWith('fonts/') && /\.(ttf|otf)$/.test(file))).toBe(true);
  });

  it('the tarball has no build outputs, sources or tests', () => {
    expect(packed.filter((file) => /\.(pptx|png)$/i.test(file))).toEqual([]);
    expect(packed.filter((file) => file.startsWith('src/'))).toEqual([]);
    expect(packed.filter((file) => file.startsWith('tests/') || file.startsWith('examples/'))).toEqual([]);
    expect(packed.filter((file) => file.startsWith('dist/') && !/\.(js|d\.ts)$/.test(file))).toEqual([]);
  });

  it(
    'empty project: install, init (package.json gets "type": "module"), build → exit 0 and a valid pptx',
    async () => {
      const project = freshDir('pptsx-pkg-project-');
      const install = npmInstall(tarball, project);
      expect(install.status, describeRun(install)).toBe(0);

      const init = pptsx(['init'], project);
      expect(init.status, describeRun(init)).toBe(0);
      const pkg = JSON.parse(readFileSync(join(project, 'package.json'), 'utf8')) as Record<string, unknown>;
      expect(pkg.type).toBe('module');
      // O init não pode perder a dependência que o npm install gravou.
      expect(Object.keys((pkg.dependencies ?? {}) as Record<string, unknown>)).toContain('pptsx');

      const build = pptsx(['build', 'deck.tsx', '--preview', 'none', '--out', 'dist'], project);
      expect(build.status, describeRun(build)).toBe(0);
      const pptx = join(project, 'dist', 'deck.16x9.pptx');
      expect(existsSync(pptx)).toBe(true);
      const zip = await JSZip.loadAsync(readFileSync(pptx));
      expect(zip.file('ppt/slides/slide1.xml')).not.toBeNull();
    },
    TIMEOUT,
  );

  it(
    'project from `npm init -y` (npm ≥ 10 writes "type": "commonjs"): init switches it to module, build → exit 0',
    async () => {
      const project = freshDir('pptsx-pkg-npminit-');
      const npmInit = run('npm', ['init', '-y'], project);
      expect(npmInit.status, describeRun(npmInit)).toBe(0);
      const install = npmInstall(tarball, project);
      expect(install.status, describeRun(install)).toBe(0);

      const init = pptsx(['init'], project);
      expect(init.status, describeRun(init)).toBe(0);
      const pkg = JSON.parse(readFileSync(join(project, 'package.json'), 'utf8')) as Record<string, unknown>;
      expect(pkg.type).toBe('module');
      // As chaves do `npm init -y` continuam lá.
      expect(pkg).toMatchObject({ version: '1.0.0', license: 'ISC' });

      const build = pptsx(['build', 'deck.tsx', '--preview', 'none', '--out', 'dist'], project);
      expect(build.status, describeRun(build)).toBe(0);
      const zip = await JSZip.loadAsync(readFileSync(join(project, 'dist', 'deck.16x9.pptx')));
      expect(zip.file('ppt/slides/slide1.xml')).not.toBeNull();
    },
    TIMEOUT,
  );

  it(
    'a CommonJS project (no init) gets the "type": "module" hint from the installed package',
    () => {
      const project = freshDir('pptsx-pkg-cjs-');
      const npmInit = run('npm', ['init', '-y'], project);
      expect(npmInit.status, describeRun(npmInit)).toBe(0);
      const install = npmInstall(tarball, project);
      expect(install.status, describeRun(install)).toBe(0);
      writeFileSync(
        join(project, 'deck.tsx'),
        "import { Deck, Slide, Text, defineDeck } from 'pptsx';\n" +
          'export default defineDeck(() => (<Deck><Slide><Text>oi</Text></Slide></Deck>));\n',
      );
      writeFileSync(
        join(project, 'tsconfig.json'),
        JSON.stringify({ compilerOptions: { jsx: 'react-jsx', jsxImportSource: 'pptsx', module: 'NodeNext', strict: true } }),
      );
      const build = pptsx(['build', 'deck.tsx', '--preview', 'none', '--out', 'dist', '--json'], project);
      expect(build.status, describeRun(build)).toBe(1);
      expect((JSON.parse(build.stdout) as { error?: unknown }).error).toMatch(/"type": "module"/);
    },
    TIMEOUT,
  );
});

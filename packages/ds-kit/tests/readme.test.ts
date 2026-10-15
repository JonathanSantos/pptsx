import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

// M18-9: os trechos `// arquivo:` do README formam um DS que compila, faz build, passa no lint e no catálogo.
const repo = fileURLToPath(new URL('../../../', import.meta.url));
const readme = readFileSync(fileURLToPath(new URL('../README.md', import.meta.url)), 'utf8');
const isWindows = process.platform === 'win32';
const tsc = join(repo, 'node_modules', '.bin', isWindows ? 'tsc.cmd' : 'tsc');
const pptsx = join(repo, 'packages', 'pptsx', 'bin', 'pptsx.mjs');
const pptsxDs = fileURLToPath(new URL('../bin/pptsx-ds.mjs', import.meta.url));

const blocks = [...readme.matchAll(/```tsx?\n\/\/ arquivo: (\S+)\n([\s\S]*?)```/g)].map(([, path, body]) => ({ path: path!, body: body! }));

const dirs: string[] = [];
afterAll(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe('README do kit', () => {
  it('tem os arquivos de um DS inteiro', () => {
    expect(blocks.map((block) => block.path)).toEqual(['tokens.ts', 'theme.ts', 'components/StatCard.tsx', 'rules.ts', 'ds.ts', 'pptsx.config.ts', 'deck.tsx']);
  });

  it('os trechos compilam, o deck faz build e passa no lint, o catálogo renderiza', () => {
    mkdirSync(join(repo, 'dist'), { recursive: true });
    const dir = mkdtempSync(join(repo, 'dist', 'readme-ds-'));
    dirs.push(dir);
    blocks.forEach((block) => {
      mkdirSync(dirname(join(dir, block.path)), { recursive: true });
      writeFileSync(join(dir, block.path), block.body);
    });
    writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({ extends: '../../tsconfig.monorepo.json', include: ['**/*.ts', '**/*.tsx'] }));
    expect(() => execFileSync(tsc, ['--noEmit', '-p', dir], { encoding: 'utf8', stdio: 'pipe', shell: isWindows })).not.toThrow();
    const build = spawnSync(process.execPath, [pptsx, 'build', join(dir, 'deck.tsx'), '--size', '16x9,4x3', '--preview', 'none', '--out', join(dir, 'dist')], { encoding: 'utf8' });
    expect(build.status, build.stdout + build.stderr).toBe(0);
    const lint = spawnSync(process.execPath, [pptsx, 'lint', join(dir, 'deck.tsx')], { encoding: 'utf8' });
    expect(lint.status, lint.stdout).toBe(0);
    const catalog = spawnSync(process.execPath, [pptsxDs, 'catalog', join(dir, 'ds.ts'), '--out', join(dir, 'catalog'), '--fixtures', join(dir, 'fixtures')], { encoding: 'utf8' });
    expect(catalog.status, catalog.stdout + catalog.stderr).toBe(0);
    expect(catalog.stdout).toContain('1 componentes, 4 renderizações');
  }, 120_000);
});

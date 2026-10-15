import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { dsNameOf, dsScaffoldFiles, initDs, tsconfigExtendsFor } from '@pptsx/ds-kit';

// M18-4: `pptsx-ds init` — o DS gerado compila, renderiza o catálogo e respeita os arquivos do autor.
const repo = fileURLToPath(new URL('../../../', import.meta.url));
const bin = fileURLToPath(new URL('../bin/pptsx-ds.mjs', import.meta.url));
// No Windows o bin é tsc.cmd e só roda com shell.
const isWindows = process.platform === 'win32';
const tscBin = join(repo, 'node_modules', '.bin', isWindows ? 'tsc.cmd' : 'tsc');
const tsc = (args: readonly string[]): string => execFileSync(tscBin, [...args], { encoding: 'utf8', stdio: 'pipe', shell: isWindows });

const dirs: string[] = [];
// Dentro do repo (dist/ é ignorado): o tsconfig gerado estende o tsconfig.monorepo.json, com paths para o fonte.
const repoDir = (): string => {
  mkdirSync(join(repo, 'dist'), { recursive: true });
  const dir = mkdtempSync(join(repo, 'dist', 'ds-init-'));
  dirs.push(dir);
  return dir;
};
afterAll(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const FILES = ['tokens.ts', 'theme.ts', 'components/Card.tsx', 'components/index.ts', 'rules.ts', 'guide.ts', 'ds.ts', 'index.ts', 'pptsx.config.ts', 'package.json', 'tsconfig.json', '.gitignore'];

describe('dsScaffoldFiles', () => {
  it('lista os arquivos do DS com o nome nas regras, no tema e no manifesto', () => {
    const files = dsScaffoldFiles('/x/Minha Marca');
    expect(files.map((file) => file.path)).toEqual(FILES);
    const content = (path: string): string => files.find((file) => file.path === path)!.content;
    expect(content('rules.ts')).toContain("'minha-marca/cores'");
    expect(content('ds.ts')).toContain("name: 'minha-marca'");
    expect(JSON.parse(content('package.json')).peerDependencies).toEqual({ pptsx: '>=1.0.0', '@pptsx/ds-kit': '>=0.2.0' });
    expect(JSON.parse(content('tsconfig.json')).extends).toBe('@pptsx/ds-kit/tsconfig.base.json');
  });

  it('--name vence o nome da pasta; pasta sem letras vira meu-ds', () => {
    expect(dsScaffoldFiles('/x/y', { name: 'aurora' }).find((file) => file.path === 'ds.ts')!.content).toContain("name: 'aurora'");
    expect(dsNameOf('/x/___')).toBe('meu-ds');
  });

  it('fora do monorepo o tsconfig estende o do kit; dentro, o tsconfig.monorepo.json', () => {
    expect(tsconfigExtendsFor(mkdtempSync(join(tmpdir(), 'ds-out-')))).toBe('@pptsx/ds-kit/tsconfig.base.json');
    expect(tsconfigExtendsFor(join(repo, 'examples', 'novo-ds'))).toBe('../../tsconfig.monorepo.json');
  });
});

describe('pptsx-ds init', () => {
  it('gera um DS que compila e cujo catálogo renderiza; --check bate com as fixtures', () => {
    const dir = repoDir();
    const out = execFileSync('node', [bin, 'init', dir], { encoding: 'utf8' });
    expect(out).toContain('criado  components/Card.tsx');
    expect(out).toContain('pptsx init --ds');
    expect(() => tsc(['--noEmit', '-p', dir])).not.toThrow();
    const catalogOut = execFileSync('node', [bin, 'catalog', join(dir, 'ds.ts'), '--out', join(dir, 'dist'), '--fixtures', join(dir, 'fixtures'), '--pptx'], { encoding: 'utf8' });
    expect(catalogOut).toContain('1 componentes, 4 renderizações');
    expect(catalogOut).toContain('Card.16x9.pptx');
    const check = execFileSync('node', [bin, 'catalog', join(dir, 'ds.ts'), '--check', '--fixtures', join(dir, 'fixtures')], { encoding: 'utf8' });
    expect(check).toContain('batem com as fixtures');
  }, 120_000);

  it('um nome CSS errado na variante gerada não compila', () => {
    const dir = repoDir();
    initDs(dir);
    const card = join(dir, 'components', 'Card.tsx');
    writeFileSync(card, readFileSync(card, 'utf8').replace('borderRadius: 8', 'borderRadiu: 8'));
    expect(() => tsc(['--noEmit', '-p', dir])).toThrow();
  }, 60_000);

  it('arquivo existente fica; --force sobrescreve', () => {
    const dir = repoDir();
    initDs(dir);
    writeFileSync(join(dir, 'tokens.ts'), '// meu\n');
    const again = initDs(dir);
    expect(again.written).toEqual([]);
    expect(again.kept).toEqual(FILES);
    expect(readFileSync(join(dir, 'tokens.ts'), 'utf8')).toBe('// meu\n');
    const forced = initDs(dir, { force: true });
    expect(forced.written).toEqual(FILES);
    expect(readFileSync(join(dir, 'tokens.ts'), 'utf8')).toContain('defineTokens');
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKAGE_TEST_ENABLED, PACKAGE_TIMEOUT, describeRun, freshDir, npmInstall, npxBin, pack, removeFreshDirs, type PackedTarball } from '../../../pptsx/tests/package/helpers.ts';

/**
 * M18-5: o kit empacotado, fora do repo — `pptsx-ds init`, o DS compila só com o `extends` do kit,
 * catálogo renderiza, `pptsx init --ds` gera um deck que compila, faz build e passa no lint.
 * Lento e com rede (instala `typescript`): só no `npm run test:package`.
 */

const packageDir = (name: string): string => fileURLToPath(new URL(`../../../${name}`, import.meta.url));

describe.skipIf(!PACKAGE_TEST_ENABLED)('@pptsx/ds-kit — npm pack → install → init → build', () => {
  let kit: PackedTarball;
  let core: PackedTarball;

  beforeAll(() => {
    const destination = freshDir('ds-kit-pack-');
    core = pack(packageDir('pptsx'), destination);
    kit = pack(packageDir('ds-kit'), destination);
  }, PACKAGE_TIMEOUT);

  afterAll(removeFreshDirs);

  it('o tarball tem o JS compilado, o bin, o tsconfig base e as licenças; nada de fonte ou teste', () => {
    for (const file of ['package.json', 'bin/pptsx-ds.mjs', 'dist/index.js', 'dist/index.d.ts', 'dist/scaffold.js', 'tsconfig.base.json', 'LICENSE', 'THIRD_PARTY.md']) {
      expect(kit.files, file).toContain(file);
    }
    expect(kit.files.filter((file) => file.startsWith('src/') || file.startsWith('tests/'))).toEqual([]);
  });

  it(
    'projeto vazio: pptsx-ds init, tsc, catálogo, pptsx init --ds, tsc, build e lint',
    () => {
      const project = freshDir('ds-kit-project-');
      writeFileSync(join(project, 'package.json'), JSON.stringify({ name: 'projeto', private: true, type: 'module' }));
      const install = npmInstall([core.tarball, kit.tarball, 'typescript@^7', '@types/node'], project);
      expect(install.status, describeRun(install)).toBe(0);

      const init = npxBin('pptsx-ds', ['init', 'marca'], project);
      expect(init.status, describeRun(init)).toBe(0);
      expect(JSON.parse(readFileSync(join(project, 'marca', 'tsconfig.json'), 'utf8')).extends).toBe('@pptsx/ds-kit/tsconfig.base.json');
      const dsTsc = npxBin('tsc', ['--noEmit', '-p', 'marca'], project);
      expect(dsTsc.status, describeRun(dsTsc)).toBe(0);

      const catalog = npxBin('pptsx-ds', ['catalog', 'marca/ds.ts', '--out', 'dist/catalog', '--fixtures', 'marca/fixtures', '--pptx'], project);
      expect(catalog.status, describeRun(catalog)).toBe(0);
      expect(existsSync(join(project, 'dist', 'catalog', 'Card.16x9.pptx'))).toBe(true);

      const deck = npxBin('pptsx', ['init', 'deck', '--ds', './marca'], project);
      expect(deck.status, describeRun(deck)).toBe(0);
      const deckTsc = npxBin('tsc', ['--noEmit', '-p', 'deck'], project);
      expect(deckTsc.status, describeRun(deckTsc)).toBe(0);
      const build = npxBin('pptsx', ['build', 'deck/deck.tsx', '--size', '16x9,4x3', '--preview', 'none', '--out', 'dist/deck'], project);
      expect(build.status, describeRun(build)).toBe(0);
      expect(existsSync(join(project, 'dist', 'deck', 'deck.4x3.pptx'))).toBe(true);
      const lint = npxBin('pptsx', ['lint', 'deck/deck.tsx'], project);
      expect(lint.status, describeRun(lint)).toBe(0);
    },
    PACKAGE_TIMEOUT,
  );
});

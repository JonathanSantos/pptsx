import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKAGE_TEST_ENABLED, PACKAGE_TIMEOUT, describeRun, freshDir, npmInstall, npxBin, pack, removeFreshDirs, type PackedTarball } from '../../../pptsx/tests/package/helpers.ts';

/**
 * M18-5: o ds-base empacotado, fora do repo — `pptsx init --ds @pptsx/ds-base` gera um deck com os
 * componentes do DS, que faz build e passa no lint com as regras da marca. Só no `npm run test:package`.
 */

const packageDir = (name: string): string => fileURLToPath(new URL(`../../../${name}`, import.meta.url));

describe.skipIf(!PACKAGE_TEST_ENABLED)('@pptsx/ds-base — npm pack → install → init --ds → build', () => {
  let base: PackedTarball;
  let tarballs: readonly string[] = [];

  beforeAll(() => {
    const destination = freshDir('ds-base-pack-');
    const packed = ['pptsx', 'ds-kit', 'ds-base'].map((name) => pack(packageDir(name), destination));
    base = packed[2]!;
    tarballs = packed.map((item) => item.tarball);
  }, PACKAGE_TIMEOUT);

  // Apagar os node_modules temporários no Windows passa dos 10 s padrão do hook.
  afterAll(removeFreshDirs, PACKAGE_TIMEOUT);

  it('o tarball tem o JS compilado, a Inter com a OFL, as licenças e o guia; nada de fonte, teste ou exemplo', () => {
    for (const file of ['package.json', 'dist/index.js', 'dist/index.d.ts', 'fonts/inter/Inter-Regular.ttf', 'fonts/inter/OFL.txt', 'LICENSE', 'THIRD_PARTY.md']) {
      expect(base.files, file).toContain(file);
    }
    expect(base.files.filter((file) => /^(src|tests|examples|fixtures)\//.test(file))).toEqual([]);
  });

  it(
    'projeto vazio: pptsx init --ds @pptsx/ds-base, build e lint',
    () => {
      const project = freshDir('ds-base-project-');
      writeFileSync(join(project, 'package.json'), JSON.stringify({ name: 'projeto', private: true, type: 'module' }));
      const install = npmInstall(tarballs, project);
      expect(install.status, describeRun(install)).toBe(0);

      const init = npxBin('pptsx', ['init', '--ds', '@pptsx/ds-base'], project);
      expect(init.status, describeRun(init)).toBe(0);
      const build = npxBin('pptsx', ['build', 'deck.tsx', '--size', '16x9,4x3', '--preview', 'none', '--out', 'dist'], project);
      expect(build.status, describeRun(build)).toBe(0);
      expect(existsSync(join(project, 'dist', 'deck.16x9.pptx'))).toBe(true);
      const lint = npxBin('pptsx', ['lint', 'deck.tsx'], project);
      expect(lint.status, describeRun(lint)).toBe(0);
    },
    PACKAGE_TIMEOUT,
  );
});

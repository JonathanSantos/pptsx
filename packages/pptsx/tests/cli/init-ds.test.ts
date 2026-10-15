import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/cli.ts';
import { dsConfigContent, dsDeckContent, withDs, type DsDeckSource } from '../../src/cli/ds-scaffold.ts';
import { parseInitCli } from '../../src/cli/init.ts';
import { scaffoldFiles } from '../../src/cli/scaffold.ts';
import { captureConsole, type CapturedConsole } from '../helpers/console.ts';

/** `pptsx init --ds <pacote|caminho>` (M18-4): o deck inicial usa o design system. */

const TIMEOUT = 120_000;
const repo = fileURLToPath(new URL('../../../../', import.meta.url));

const dirs: string[] = [];
const repoDir = (): string => {
  mkdirSync(join(repo, 'dist'), { recursive: true });
  const dir = mkdtempSync(join(repo, 'dist', 'init-ds-'));
  dirs.push(dir);
  return dir;
};
afterAll(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

let output: CapturedConsole;
beforeEach(() => {
  output = captureConsole();
});
afterEach(() => output.restore());

const SOURCE: DsDeckSource = {
  importFrom: '@marca/ds',
  dsName: 'marca',
  dsExport: 'named',
  theme: { colors: { light1: '#FAFAFA', dark1: '#111111' } },
  components: [
    { name: 'Card', props: { title: 'Olá "mundo"', size: 'lg', count: 3, items: ['a', 'b'], strong: true, footer: { type: 'box', props: {} } } },
    { name: 'Badge', props: { label: 'Novo' } },
  ],
};

describe('dsDeckContent / dsConfigContent', () => {
  it('importa os componentes do DS e faz um slide por componente com as props do catálogo', () => {
    const deck = dsDeckContent(SOURCE);
    expect(deck).toContain("import { Card, Badge } from '@marca/ds';");
    expect(deck).toContain('backgroundColor="#FAFAFA" color="#111111"');
    expect(deck).toContain('<Card title={"Olá \\"mundo\\""} size="lg" count={3} items={["a","b"]} strong footer={<Text>footer</Text>} />');
    expect(deck).toContain('<Badge label="Novo" />');
    expect(deck.match(/<Slide /g)).toHaveLength(2);
  });

  it('sem componentes com catálogo: um slide explicando, sem import do DS', () => {
    const deck = dsDeckContent({ ...SOURCE, components: [] });
    expect(deck).not.toContain('@marca/ds');
    expect(deck).toContain('Nenhum componente do marca tem caso de catálogo');
  });

  it('a config registra o DS (nomeado ou default) e o tema só quando há', () => {
    expect(dsConfigContent(SOURCE)).toContain("import { ds } from '@marca/ds';");
    expect(dsConfigContent(SOURCE)).toContain('defineConfig({ ds: [ds], theme: ds.theme })');
    const plain = dsConfigContent({ ...SOURCE, dsExport: 'default', theme: undefined });
    expect(plain).toContain("import ds from '@marca/ds';");
    expect(plain).toContain('defineConfig({ ds: [ds] })');
  });

  it('withDs: DS por caminho entra no include do tsconfig; no monorepo, extends', () => {
    const files = withDs(scaffoldFiles('x'), { ...SOURCE, dsDir: '../meu-ds', tsconfigExtends: '../../tsconfig.monorepo.json' });
    const tsconfig = JSON.parse(files.find((file) => file.path === 'tsconfig.json')!.content);
    expect(tsconfig.extends).toBe('../../tsconfig.monorepo.json');
    expect(tsconfig.include).toEqual(['**/*.ts', '**/*.tsx', '../meu-ds/**/*.ts', '../meu-ds/**/*.tsx']);
    const standalone = JSON.parse(withDs(scaffoldFiles('x'), SOURCE).find((file) => file.path === 'tsconfig.json')!.content);
    expect(standalone.compilerOptions.jsxImportSource).toBe('pptsx');
  });

  it('parseInitCli aceita --ds', () => {
    expect(parseInitCli(['init', 'deck', '--ds', '@marca/ds'], '/tmp').ds).toBe('@marca/ds');
    expect(parseInitCli(['init'], '/tmp').ds).toBeUndefined();
  });
});

describe('pptsx init --ds (ds-base)', () => {
  it(
    'por caminho: o deck importa os componentes, compila, faz build e passa no lint com as regras do DS',
    async () => {
      const dir = repoDir();
      expect(await runCli(['init', dir, '--ds', join(repo, 'packages', 'ds-base', 'src')], repo)).toBe(0);
      const deck = readFileSync(join(dir, 'deck.tsx'), 'utf8');
      expect(deck).toMatch(/import \{ Bullets, KpiCard, KpiRow, TwoColumn \} from '\.\.\/\.\.\/packages\/ds-base\/src\/index\.ts';/);
      expect(readFileSync(join(dir, 'pptsx.config.ts'), 'utf8')).toContain('theme: ds.theme');
      expect(await runCli(['build', join(dir, 'deck.tsx'), '--size', '16x9,4x3', '--out', join(dir, 'dist')], repo)).toBe(0);
      expect(existsSync(join(dir, 'dist', 'deck.4x3.pptx'))).toBe(true);
      output.logs.length = 0;
      expect(await runCli(['lint', join(dir, 'deck.tsx')], repo)).toBe(0);
      expect(output.logs.join('\n')).toContain('nada a apontar');
    },
    TIMEOUT,
  );

  it(
    'por pacote: importa do nome do pacote',
    async () => {
      const dir = repoDir();
      expect(await runCli(['init', dir, '--ds', '@pptsx/ds-base'], repo)).toBe(0);
      expect(readFileSync(join(dir, 'deck.tsx'), 'utf8')).toContain("from '@pptsx/ds-base';");
      expect(readFileSync(join(dir, 'pptsx.config.ts'), 'utf8')).toContain("import { ds } from '@pptsx/ds-base';");
    },
    TIMEOUT,
  );

  it('caminho que não é DS: erro claro', async () => {
    const dir = repoDir();
    expect(await runCli(['init', dir, '--ds', join(repo, 'packages', 'ds-base', 'src', 'tokens.ts')], repo)).toBe(1);
    expect(output.errors.join('\n')).toContain('precisa exportar "ds"');
  }, TIMEOUT);
});

import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { decodePng, pixelDiffRatio } from '../helpers/png-pixels.ts';

/**
 * M18-7: o bundle de arquivo único (`dist/standalone/pptsx.mjs`) contra o build normal. Cada deck dos
 * examples (núcleo, legacy e, com os dist/ dos DS, o ds-base) é gerado pelos dois: XML dos .pptx idêntico
 * (menos docProps/core.xml; a planilha do gráfico é comparada por dentro), PNGs com no máximo 1 % de pixels
 * diferentes (resvg nativo × wasm) e a demo em até 2× o tempo. Lento: só no `npm run test:standalone`.
 */

const ENABLED = Boolean(process.env.PPTSX_STANDALONE_TEST);
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const REPO = join(ROOT, '..', '..');
const BUNDLE = join(ROOT, 'dist', 'standalone', 'pptsx.mjs');
const NORMAL = join(ROOT, 'bin', 'pptsx.mjs');
const TIMEOUT = 600_000;
const MAX_PIXEL_DIFF = 0.01;
const MAX_SLOWDOWN = 2;

const dirs: string[] = [];
const freshDir = (prefix: string): string => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
};
afterAll(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const decksIn = (dir: string): readonly string[] =>
  existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.tsx')).map((name) => join(dir, name)) : [];

// Os DS entram quando os dist/ deles existem: o bundle resolve @pptsx/* pelo node_modules, como um usuário.
const dsBuilt = existsSync(join(REPO, 'packages', 'ds-base', 'dist', 'index.js')) && existsSync(join(REPO, 'packages', 'ds-kit', 'dist', 'index.js'));
const DECKS = [
  ...decksIn(join(ROOT, 'examples')),
  ...decksIn(join(ROOT, 'examples', 'diagrams')),
  ...decksIn(join(ROOT, 'tests', 'examples', 'legacy')),
  ...(dsBuilt ? [...decksIn(join(REPO, 'packages', 'ds-base', 'examples')), ...decksIn(join(REPO, 'packages', 'ds-base', 'examples', 'gallery'))] : []),
];

interface Run {
  readonly status: number | null;
  readonly ms: number;
  readonly output: string;
}

const build = (bin: string, deck: string, out: string, cwd: string = REPO, env: NodeJS.ProcessEnv = process.env): Run => {
  const start = performance.now();
  const proc = spawnSync(process.execPath, [bin, 'build', deck, '--size', '16x9,4x3', '--out', out], { cwd, encoding: 'utf8', timeout: TIMEOUT, env });
  return { status: proc.status, ms: performance.now() - start, output: `${proc.stdout}\n${proc.stderr}` };
};

const filesOf = (dir: string): readonly string[] =>
  readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? filesOf(join(dir, name)) : [join(dir, name)]));

// docProps/core.xml leva a data do build; a planilha embutida é um zip com data própria: compara por dentro.
const zipEntriesOf = async (buffer: Buffer): Promise<ReadonlyMap<string, Buffer>> => {
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files).filter((name) => !zip.files[name]!.dir && name !== 'docProps/core.xml');
  const entries = await Promise.all(
    names.map(async (name): Promise<readonly [string, Buffer][]> => {
      const content = await zip.file(name)!.async('nodebuffer');
      if (!name.endsWith('.xlsx')) return [[name, content]];
      const inner = await zipEntriesOf(content);
      return [...inner].map(([innerName, value]) => [`${name}!${innerName}`, value]);
    }),
  );
  return new Map(entries.flat());
};

const pptxDiffs = async (a: string, b: string): Promise<readonly string[]> => {
  const [left, right] = await Promise.all([a, b].map(async (file) => zipEntriesOf(readFileSync(file))));
  const names = [...new Set([...left!.keys(), ...right!.keys()])];
  return names.filter((name) => !left!.get(name)?.equals(right!.get(name) ?? Buffer.alloc(0)));
};

describe.skipIf(!ENABLED)('standalone — bundle × build normal', () => {
  it('o bundle existe (npm run build:standalone) e o SHA256SUMS confere', () => {
    expect(existsSync(BUNDLE)).toBe(true);
    const sums = readFileSync(join(ROOT, 'dist', 'standalone', 'SHA256SUMS'), 'utf8');
    expect(sums).toMatch(/^[0-9a-f]{64} {2}pptsx\.mjs\n$/);
  });

  it.each(DECKS.map((deck) => [relative(REPO, deck), deck]))(
    '%s: XML idêntico e PNGs ≤ 1 %',
    async (_name, deck) => {
      const out = freshDir('pptsx-standalone-');
      const normal = build(NORMAL, deck, join(out, 'normal'));
      const bundled = build(BUNDLE, deck, join(out, 'bundle'));
      expect(bundled.status, bundled.output).toBe(normal.status);
      // Deck que nem gera arquivo (asset ausente…): o mesmo erro nos dois.
      if (!existsSync(join(out, 'normal'))) {
        expect(existsSync(join(out, 'bundle'))).toBe(false);
        expect(bundled.output.trim()).toBe(normal.output.trim());
        return;
      }
      const files = filesOf(join(out, 'normal')).map((file) => relative(join(out, 'normal'), file));
      expect(filesOf(join(out, 'bundle')).map((file) => relative(join(out, 'bundle'), file)).sort()).toEqual([...files].sort());
      for (const file of files.filter((name) => name.endsWith('.pptx'))) {
        expect(await pptxDiffs(join(out, 'normal', file), join(out, 'bundle', file)), file).toEqual([]);
      }
      for (const file of files.filter((name) => name.endsWith('.png'))) {
        const ratio = pixelDiffRatio(decodePng(readFileSync(join(out, 'normal', file))), decodePng(readFileSync(join(out, 'bundle', file))));
        expect(ratio, file).toBeLessThanOrEqual(MAX_PIXEL_DIFF);
      }
      const diagnostics = (dir: string) => JSON.parse(readFileSync(join(out, dir, `${basename(deck, '.tsx')}.diagnostics.json`), 'utf8')) as unknown;
      expect(diagnostics('bundle')).toEqual(diagnostics('normal'));
    },
    TIMEOUT,
  );

  it(
    'pasta sem node_modules nem tsconfig: a demo sai, em até 2× o tempo do build normal',
    () => {
      const dir = freshDir('pptsx-standalone-alone-');
      cpSync(BUNDLE, join(dir, 'pptsx.mjs'));
      cpSync(join(ROOT, 'tests', 'examples', 'legacy'), join(dir, 'deck'), { recursive: true });
      mkdirSync(join(dir, 'cache'));
      const env = { ...process.env, PPTSX_CACHE: join(dir, 'cache') };
      const alone = build(join(dir, 'pptsx.mjs'), 'deck/demo.tsx', 'out', dir, env);
      expect(alone.status, alone.output).toBe(0);
      expect(existsSync(join(dir, 'out', 'demo.16x9.pptx'))).toBe(true);
      expect(existsSync(join(dir, 'cache', JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version, 'fonts', 'LiberationSans-Regular.ttf'))).toBe(true);
      const normal = build(NORMAL, join(ROOT, 'tests', 'examples', 'legacy', 'demo.tsx'), join(dir, 'normal'));
      expect(alone.ms).toBeLessThanOrEqual(normal.ms * MAX_SLOWDOWN);
    },
    TIMEOUT,
  );

  it('--version diz standalone; doctor mostra Node, fontes e espaço', () => {
    const version = spawnSync(process.execPath, [BUNDLE, '--version'], { encoding: 'utf8' });
    expect(version.stdout.trim()).toMatch(/^\d+\.\d+\.\d+ \(standalone\)$/);
    const doctor = spawnSync(process.execPath, [BUNDLE, 'doctor'], { encoding: 'utf8' });
    expect(doctor.status).toBe(0);
    expect(doctor.stdout).toContain(`Node ${process.version}`);
    expect(doctor.stdout).toContain('Fontes embutidas');
    expect(doctor.stdout).toContain('Espaço livre');
  });
});

import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildOverview, COMPONENT_META, defaultFontFiles, renderFragment, type Component, type FontFace, type PositionedNode, type SizeSpec, type Theme } from 'pptsx';
import { jsx } from 'pptsx/jsx-runtime';
import type { CatalogCase, Ds } from './ds.ts';

/**
 * Catálogo do DS: cada componente com `meta.catalog` é renderizado isolado (`renderFragment` do núcleo)
 * em cada caso e tamanho. Grava um PNG por caso, um overview por componente e `fixtures/<Componente>.json`
 * com os frames; `check: true` compara com as fixtures (±1 pt) em vez de gravar — o contrato visual do DS.
 */

export interface FrameFixture {
  readonly path: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** { [caso]: { [tamanho]: frames } } */
export type ComponentFixture = Readonly<Record<string, Readonly<Record<string, readonly FrameFixture[]>>>>;

export interface CatalogOptions {
  readonly ds: Pick<Ds, 'implementations'> & { readonly theme?: Theme };
  readonly sizes?: readonly SizeSpec[];
  /** Pasta dos PNGs e overviews; sem ela, nada de imagem. */
  readonly out?: string;
  /** Pasta das fixtures (padrão: <out>/fixtures). */
  readonly fixtures?: string;
  /** Compara com as fixtures em vez de gravar. */
  readonly check?: boolean;
  readonly tolerance?: number;
  readonly fonts?: readonly FontFace[];
  readonly baseDir?: string;
}

export interface CatalogDiff {
  readonly component: string;
  readonly case: string;
  readonly size: string;
  readonly message: string;
}

export interface CatalogResult {
  readonly components: readonly string[];
  readonly cases: number;
  readonly files: readonly string[];
  readonly diffs: readonly CatalogDiff[];
}

const DEFAULT_SIZES: readonly SizeSpec[] = ['16x9', '4x3'];
const DEFAULT_TOLERANCE = 1;
const THUMB_WIDTH = 480;

const round = (value: number): number => Math.round(value * 100) / 100;

const framesOf = (nodes: readonly PositionedNode[]): readonly FrameFixture[] =>
  nodes.flatMap((node) => [
    { path: node.path, x: round(node.frame.x), y: round(node.frame.y), width: round(node.frame.width), height: round(node.frame.height) },
    ...(node.kind === 'box' ? framesOf(node.children) : []),
  ]);

const casesOf = (component: Component): readonly CatalogCase[] => {
  const cases = component[COMPONENT_META]?.catalog;
  return Array.isArray(cases) ? (cases as readonly CatalogCase[]) : [];
};

const nameOf = (component: Component): string => component[COMPONENT_META]?.name ?? (component.name || 'Anonymous');

/** Diferenças entre os frames de agora e os da fixture (paths diferentes ou frame fora da tolerância). */
export const compareFrames = (expected: readonly FrameFixture[], actual: readonly FrameFixture[], tolerance: number): readonly string[] => {
  const paths = (frames: readonly FrameFixture[]) => frames.map((frame) => frame.path).join(', ');
  if (paths(expected) !== paths(actual)) return [`nós diferentes: era [${paths(expected)}], agora [${paths(actual)}]`];
  return expected.flatMap((frame, index) => {
    const now = actual[index]!;
    const off = (['x', 'y', 'width', 'height'] as const).filter((key) => Math.abs(frame[key] - now[key]) > tolerance);
    return off.length === 0 ? [] : [`${frame.path}: ${off.map((key) => `${key} ${frame[key]} → ${now[key]}`).join(', ')}`];
  });
};

export const catalog = async (options: CatalogOptions): Promise<CatalogResult> => {
  const sizes = options.sizes ?? DEFAULT_SIZES;
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  const fixturesDir = options.fixtures ?? (options.out === undefined ? undefined : join(options.out, 'fixtures'));
  const components = options.ds.implementations.filter((component) => casesOf(component).length > 0);
  const files: string[] = [];
  const diffs: CatalogDiff[] = [];
  let count = 0;
  for (const component of components) {
    const name = nameOf(component);
    const fixture: Record<string, Record<string, readonly FrameFixture[]>> = {};
    const thumbs: { png: Buffer; label: string }[] = [];
    for (const item of casesOf(component)) {
      fixture[item.name] = {};
      for (const size of sizes) {
        const result = await renderFragment(jsx(component, item.props), {
          size,
          ...(item.fill === true ? { fill: true } : {}),
          png: options.out !== undefined && options.check !== true,
          ...(options.fonts === undefined ? {} : { fonts: options.fonts }),
          ...(options.ds.theme === undefined ? {} : { theme: options.ds.theme }),
          ...(options.baseDir === undefined ? {} : { baseDir: options.baseDir }),
        });
        count += 1;
        fixture[item.name]![result.size.name] = framesOf(result.slide.children);
        if (result.png !== undefined) thumbs.push({ png: result.png, label: `${item.name} · ${result.size.name}` });
      }
    }
    const fixtureFile = fixturesDir === undefined ? undefined : join(fixturesDir, `${name}.json`);
    if (options.check === true) {
      if (fixtureFile === undefined || !existsSync(fixtureFile)) {
        diffs.push({ component: name, case: '*', size: '*', message: `sem fixture (${fixtureFile ?? 'pasta não informada'}); rode o catálogo sem --check para gravar` });
        continue;
      }
      const expected = JSON.parse(readFileSync(fixtureFile, 'utf8')) as ComponentFixture;
      Object.entries(fixture).forEach(([caseName, bySize]) =>
        Object.entries(bySize).forEach(([size, frames]) => {
          const before = expected[caseName]?.[size];
          const problems = before === undefined ? ['caso/tamanho novo, sem fixture'] : compareFrames(before, frames, tolerance);
          problems.forEach((message) => diffs.push({ component: name, case: caseName, size, message }));
        }),
      );
      continue;
    }
    if (fixtureFile !== undefined) {
      mkdirSync(fixturesDir!, { recursive: true });
      writeFileSync(fixtureFile, `${JSON.stringify(fixture, null, 2)}\n`);
      files.push(fixtureFile);
    }
    if (options.out !== undefined && thumbs.length > 0) {
      const dir = join(options.out, name);
      mkdirSync(dir, { recursive: true });
      thumbs.forEach((thumb, index) => {
        const file = join(dir, `${String(index + 1).padStart(2, '0')}-${thumb.label.replace(/[^\p{L}\p{N}]+/gu, '-')}.png`);
        writeFileSync(file, thumb.png);
        files.push(file);
      });
      const overview = join(options.out, `${name}.overview.png`);
      writeFileSync(overview, buildOverview(thumbs.map((thumb, index) => ({ png: thumb.png, number: index + 1, label: thumb.label })), { columns: sizes.length, thumbWidth: THUMB_WIDTH, fontFiles: defaultFontFiles() }));
      files.push(overview);
    }
  }
  return { components: components.map(nameOf), cases: count, files, diffs };
};

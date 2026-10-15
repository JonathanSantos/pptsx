import { readFileSync } from 'node:fs';
import { resolveAssetPath } from '../core/assets.ts';
import { DEFAULTS } from '../core/defaults.ts';
import type { IconContent, IconProps, Rect } from '../core/types.ts';
import { ResolveError } from './errors.ts';
import { assertOneOf } from './shape.ts';
import { readIcon } from './svg-icon.ts';

/**
 * Icon (M12-4): a leitura do arquivo é a única IO do resolve e vem injetada (`ResolveEnv`); o
 * render passa uma que resolve `src` contra o baseDir. Sem env, relativo ao cwd.
 */

export interface ResolveEnv {
  /** Conteúdo (texto) de um asset do deck, ex.: o SVG de um Icon. */
  readonly readAsset: (src: string) => string;
}

export const createResolveEnv = (baseDir: string = process.cwd()): ResolveEnv => ({
  readAsset: (src) => readFileSync(resolveAssetPath(baseDir, src), 'utf8'),
});

type IconResolvedProps = Omit<IconProps, 'children'>;

const RENDERS = ['auto', 'shape', 'image'] as const;

const assertProps = (props: IconResolvedProps, path: string): void => {
  if (typeof props.src !== 'string' || props.src === '') throw new ResolveError('<Icon> precisa de src (arquivo .svg)', path);
  if (props.size !== undefined && !(typeof props.size === 'number' && props.size > 0)) {
    throw new ResolveError(`<Icon>: size ${JSON.stringify(props.size)} inválido; use um número positivo (pt)`, path);
  }
  assertOneOf(props.render, RENDERS, '<Icon>: render', path);
};

const readSource = (env: ResolveEnv, src: string, path: string): string => {
  try {
    return env.readAsset(src);
  } catch (error) {
    throw new ResolveError(`<Icon>: não consegui ler ${JSON.stringify(src)} (${(error as Error).message})`, path);
  }
};

export interface IconGeometry {
  readonly viewBox: Rect;
  readonly content: IconContent;
}

export const iconGeometryOf = (props: IconResolvedProps, path: string, env: ResolveEnv): IconGeometry => {
  assertProps(props, path);
  const svg = readSource(env, props.src, path);
  const options = { color: props.color ?? DEFAULTS.text.color, recolor: props.recolor ?? true };
  const icon = readIcon(svg, options, props.render === 'image');
  if (props.render === 'shape' && 'raster' in icon.content) {
    throw new ResolveError(`<Icon render="shape">: o SVG não vira forma nativa (${icon.content.reason}); use render="auto" ou simplifique o SVG`, path);
  }
  return icon;
};

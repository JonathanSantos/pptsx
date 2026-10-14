import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { FontFace, SizeSpec } from './core/types.ts';

export const CONFIG_FILE_NAME = 'pptsx.config.ts';

export interface TsxSlidesConfig {
  /** Substitui as fontes padrão (Liberation Sans como Arial), como em RenderOptions.fonts. */
  readonly fonts?: readonly FontFace[];
  readonly sizes?: readonly SizeSpec[];
  readonly lang?: string;
  readonly textSafety?: number;
}

/** Identidade tipada: só existe para o arquivo de config ganhar inferência. */
export const defineConfig = (config: TsxSlidesConfig): TsxSlidesConfig => config;

/** Caminhos de fonte na config são relativos ao arquivo de config, não ao cwd de quem roda a CLI. */
export const resolveConfigPaths = (config: TsxSlidesConfig, configDir: string): TsxSlidesConfig => {
  if (!config.fonts) return config;
  const fonts = config.fonts.map((face) => (isAbsolute(face.file) ? face : { ...face, file: resolve(configDir, face.file) }));
  return { ...config, fonts };
};

const isConfigObject = (value: unknown): value is TsxSlidesConfig =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Carrega `pptsx.config.ts` de `cwd` (precisa rodar sob o loader do tsx); sem arquivo → {}. */
export const loadConfig = async (cwd: string): Promise<TsxSlidesConfig> => {
  const file = join(resolve(cwd), CONFIG_FILE_NAME);
  if (!existsSync(file)) return {};
  const module = await import(pathToFileURL(file).href);
  if (!isConfigObject(module.default)) throw new Error(`${file} precisa exportar default defineConfig({ ... })`);
  return resolveConfigPaths(module.default, dirname(file));
};

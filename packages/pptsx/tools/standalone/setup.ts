import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import * as nodeModule from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { isMainThread } from 'node:worker_threads';
import { FONTS, GUIDE, HOOKS_SOURCE, VERSION } from 'pptsx-standalone:assets';
import { setStandaloneRuntime } from '../../src/standalone.ts';

/**
 * M18-7: primeiro módulo do bundle (antes de qualquer módulo do núcleo): grava as fontes embutidas na
 * pasta de cache, preenche o runtime e registra os hooks que compilam o deck do usuário.
 */

/** ~/.cache/pptsx (XDG), %LOCALAPPDATA%\pptsx\Cache no Windows; PPTSX_CACHE vence. */
export const cacheRoot = (): string => {
  if (process.env.PPTSX_CACHE) return process.env.PPTSX_CACHE;
  if (process.platform === 'win32') return join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'pptsx', 'Cache');
  return join(process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), 'pptsx');
};

const writeFonts = (dir: string): string => {
  mkdirSync(dir, { recursive: true });
  Object.entries(FONTS).forEach(([name, base64]) => {
    const file = join(dir, name);
    const bytes = Buffer.from(base64, 'base64');
    if (!existsSync(file) || statSync(file).size !== bytes.length) writeFileSync(file, bytes);
  });
  return dir;
};

// Home sem escrita (CI, contêiner): cai para a pasta temporária.
const fontDirOf = (): string => {
  try {
    return writeFonts(join(cacheRoot(), VERSION, 'fonts'));
  } catch {
    return writeFonts(join(tmpdir(), `pptsx-${VERSION}-fonts`));
  }
};

export const FONT_DIR = fontDirOf();

setStandaloneRuntime({ version: VERSION, guide: GUIDE, fontDir: FONT_DIR });

/** `module.register` existe a partir do Node 20.6; sem ele o deck .tsx não carrega (o doctor avisa). */
export const HOOKS_AVAILABLE = typeof nodeModule.register === 'function';

if (isMainThread && HOOKS_AVAILABLE) {
  nodeModule.register(`data:text/javascript;base64,${Buffer.from(HOOKS_SOURCE).toString('base64')}`, { data: { bundleUrl: import.meta.url } });
}
